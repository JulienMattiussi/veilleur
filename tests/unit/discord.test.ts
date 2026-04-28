import { describe, it, expect } from "vitest";
import { verifyDiscordSignature } from "@/lib/discord";

describe("verifyDiscordSignature", () => {
  it("returns false for garbage inputs", () => {
    expect(verifyDiscordSignature("body", "badsig", "ts", "badkey")).toBe(false);
  });

  it("returns false when signature length is wrong", () => {
    expect(verifyDiscordSignature("body", "aabb", "1234567890", "a".repeat(64))).toBe(false);
  });
});
