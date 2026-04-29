import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parsePeriod, periodLabel } from "@/lib/period";

const FIXED_NOW = new Date("2024-06-15T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parsePeriod", () => {
  it("returns 1 day ago for '1j'", () => {
    const result = parsePeriod("1j");
    expect(result.getTime()).toBe(FIXED_NOW - 1 * 24 * 60 * 60 * 1000);
  });

  it("returns 7 days ago for '7j'", () => {
    const result = parsePeriod("7j");
    expect(result.getTime()).toBe(FIXED_NOW - 7 * 24 * 60 * 60 * 1000);
  });

  it("returns 30 days ago for '30j'", () => {
    const result = parsePeriod("30j");
    expect(result.getTime()).toBe(FIXED_NOW - 30 * 24 * 60 * 60 * 1000);
  });

  it("defaults to 7 days for unknown period", () => {
    const result = parsePeriod("invalid");
    expect(result.getTime()).toBe(FIXED_NOW - 7 * 24 * 60 * 60 * 1000);
  });
});

describe("periodLabel", () => {
  it("returns 'hier' for 1j", () => {
    expect(periodLabel("1j")).toBe("hier");
  });

  it("returns '7 derniers jours' for 7j", () => {
    expect(periodLabel("7j")).toBe("7 derniers jours");
  });

  it("returns '30 derniers jours' for 30j", () => {
    expect(periodLabel("30j")).toBe("30 derniers jours");
  });
});
