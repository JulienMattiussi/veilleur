import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyDiscordSignature, fetchAllMessagesInPeriod } from "@/lib/discord";

describe("verifyDiscordSignature", () => {
  it("returns false for garbage inputs", () => {
    expect(verifyDiscordSignature("body", "badsig", "ts", "badkey")).toBe(false);
  });

  it("returns false when signature length is wrong", () => {
    expect(verifyDiscordSignature("body", "aabb", "1234567890", "a".repeat(64))).toBe(false);
  });
});

describe("fetchAllMessagesInPeriod", () => {
  const DISCORD_EPOCH = 1420070400000n;
  const snowflake = (iso: string) => ((BigInt(Date.parse(iso)) - DISCORD_EPOCH) << 22n).toString();
  const message = (iso: string) => ({
    id: snowflake(iso),
    content: "",
    timestamp: iso,
    author: { id: "u1", username: "alice" },
  });

  beforeEach(() => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function respondWith(batch: unknown[]) {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(batch)));
  }

  it("starts from the end date and stops at the start date", async () => {
    respondWith([message("2026-09-10T10:00:00.000Z"), message("2026-08-20T10:00:00.000Z")]);
    const { messages, truncated } = await fetchAllMessagesInPeriod(
      "c1",
      new Date("2026-09-01T00:00:00.000Z"),
      { until: new Date("2026-09-15T00:00:00.000Z") },
    );
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      `before=${snowflake("2026-09-15T00:00:00.000Z")}`,
    );
    expect(messages.map((m) => m.timestamp)).toEqual(["2026-09-10T10:00:00.000Z"]);
    expect(truncated).toBe(false);
  });

  it("reports truncation when maxPages is reached", async () => {
    respondWith(Array.from({ length: 100 }, () => message("2026-09-10T10:00:00.000Z")));
    const { messages, truncated } = await fetchAllMessagesInPeriod(
      "c1",
      new Date("2026-09-01T00:00:00.000Z"),
      { until: new Date("2026-09-15T00:00:00.000Z"), maxPages: 1 },
    );
    expect(messages).toHaveLength(100);
    expect(truncated).toBe(true);
  });
});
