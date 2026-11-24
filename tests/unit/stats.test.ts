import { describe, it, expect } from "vitest";
import { computeStats, countOccurrences, makeExcerpt } from "@/lib/stats";
import type { DiscordMessage } from "@/lib/discord";

function msg(
  id: string,
  authorId: string,
  content: string,
  extra: Partial<DiscordMessage["author"]> = {},
): DiscordMessage {
  return {
    id,
    content,
    timestamp: `2026-11-0${id}T10:00:00.000Z`,
    author: { id: authorId, username: `user-${authorId}`, ...extra },
  };
}

const messages = [
  msg("1", "a", "Rust 2.0 est sorti https://github.com/rust-lang/rust"),
  msg("2", "b", "Un article sur RUST et trust https://blog.example.com/rust"),
  msg("3", "a", "Rien à voir https://github.com/vercel/next.js"),
  msg("4", "bot", "rust rust", { bot: true }),
];

describe("countOccurrences", () => {
  it("counts case-insensitive substrings", () => {
    expect(countOccurrences("Rust, rust et TRUST", "rust")).toBe(3);
  });

  it("returns 0 for an empty term", () => {
    expect(countOccurrences("abc", "")).toBe(0);
  });
});

describe("makeExcerpt", () => {
  it("collapses whitespace and keeps short messages whole", () => {
    expect(makeExcerpt("a\n\n  b", undefined, 20)).toBe("a b");
  });

  it("truncates long messages from the start", () => {
    expect(makeExcerpt("x".repeat(30), undefined, 10)).toBe(`${"x".repeat(10)}…`);
  });

  it("centers on the term when it would be cut off", () => {
    const excerpt = makeExcerpt(`${"x".repeat(100)} rust ${"y".repeat(100)}`, "RUST", 60);
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).toContain("rust");
  });
});

describe("computeStats", () => {
  it("keeps all human messages when there is no filter, most recent first", () => {
    const stats = computeStats(messages, {});
    expect(stats.messages.map((m) => m.id)).toEqual(["3", "2", "1"]);
    expect(stats.termOccurrences).toBe(0);
  });

  it("filters by author", () => {
    const stats = computeStats(messages, { authorId: "a" });
    expect(stats.messages.map((m) => m.id)).toEqual(["3", "1"]);
  });

  it("filters by term (case-insensitive substring) and counts occurrences", () => {
    const stats = computeStats(messages, { term: "rust" });
    expect(stats.messages.map((m) => m.id)).toEqual(["2", "1"]);
    // msg 1: "Rust" + URL "rust-lang/rust" (2) ; msg 2: "RUST", "trust", URL "/rust"
    expect(stats.termOccurrences).toBe(6);
  });

  it("combines author and term filters", () => {
    const stats = computeStats(messages, { authorId: "b", term: "rust" });
    expect(stats.messages.map((m) => m.id)).toEqual(["2"]);
  });

  it("ranks authors by messages, with their shared links", () => {
    const stats = computeStats(messages, {});
    expect(stats.topAuthors).toEqual([
      { name: "user-a", messages: 2, links: 2 },
      { name: "user-b", messages: 1, links: 1 },
    ]);
  });

  it("ranks shared domains", () => {
    const stats = computeStats(messages, {});
    expect(stats.topDomains).toEqual([
      { domain: "github.com", links: 2 },
      { domain: "blog.example.com", links: 1 },
    ]);
  });
});
