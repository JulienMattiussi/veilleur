import { describe, it, expect } from "vitest";
import { parseDateInput, resolveDateRange } from "@/lib/date-range";

// 19/11/2026 at 15:00 in Paris (UTC+1 in winter)
const NOW = new Date("2026-11-19T14:00:00.000Z");

describe("parseDateInput", () => {
  it("accepts DD/MM/YYYY and D/M/YYYY", () => {
    expect(parseDateInput("01/09/2026")).toEqual({ year: 2026, month: 9, day: 1 });
    expect(parseDateInput("1/9/2026")).toEqual({ year: 2026, month: 9, day: 1 });
  });

  it("accepts YYYY-MM-DD", () => {
    expect(parseDateInput(" 2026-09-01 ")).toEqual({ year: 2026, month: 9, day: 1 });
  });

  it("rejects impossible dates and other formats", () => {
    expect(parseDateInput("31/02/2026")).toBeNull();
    expect(parseDateInput("2026/09/01")).toBeNull();
    expect(parseDateInput("hier")).toBeNull();
  });
});

describe("resolveDateRange", () => {
  it("defaults to the 30 days before today, today included", () => {
    const range = resolveDateRange(undefined, undefined, NOW);
    if ("error" in range) throw new Error(range.error);
    expect(range.startLabel).toBe("20/10/2026");
    expect(range.endLabel).toBe("19/11/2026");
    // Midnight in Paris: UTC+2 before the DST change (25/10), UTC+1 after
    expect(range.since.toISOString()).toBe("2026-10-19T22:00:00.000Z");
    expect(range.until.toISOString()).toBe("2026-11-19T23:00:00.000Z");
  });

  it("includes the whole end day", () => {
    const range = resolveDateRange("2026-09-01", "15/09/2026", NOW);
    if ("error" in range) throw new Error(range.error);
    expect(range.since.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(range.until.toISOString()).toBe("2026-09-15T22:00:00.000Z");
  });

  it("starts 30 days before a given end date", () => {
    const range = resolveDateRange(undefined, "31/08/2026", NOW);
    if ("error" in range) throw new Error(range.error);
    expect(range.startLabel).toBe("01/08/2026");
  });

  it("reports invalid dates", () => {
    expect(resolveDateRange("32/01/2026", undefined, NOW)).toEqual({
      error: expect.stringContaining("Date de début invalide"),
    });
    expect(resolveDateRange(undefined, "demain", NOW)).toEqual({
      error: expect.stringContaining("Date de fin invalide"),
    });
  });

  it("rejects a start date after the end date or in the future", () => {
    expect(resolveDateRange("10/09/2026", "01/09/2026", NOW)).toEqual({
      error: "La date de début doit précéder la date de fin.",
    });
    expect(resolveDateRange("01/12/2026", "31/12/2026", NOW)).toEqual({
      error: "La date de début est dans le futur.",
    });
  });
});
