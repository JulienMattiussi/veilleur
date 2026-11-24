import { describe, it, expect } from "vitest";
import { escapeExcerpt, messageLink, renderStatsPage } from "@/lib/stats-formatter";
import type { StatsReport } from "@/lib/stats";

function makeReport(messageCount: number, overrides: Partial<StatsReport> = {}): StatsReport {
  return {
    id: "abc123",
    guildId: "g1",
    channelId: "c1",
    channelName: "veille",
    startLabel: "20/10/2026",
    endLabel: "19/11/2026",
    scannedCount: 500,
    truncated: false,
    termOccurrences: 0,
    topAuthors: [{ name: "alice", messages: 3, links: 1 }],
    topDomains: [{ domain: "github.com", links: 4 }],
    messages: Array.from({ length: messageCount }, (_, i) => ({
      id: `m${i}`,
      author: "alice",
      timestamp: "2026-11-12T10:00:00.000Z",
      excerpt: `Message numéro ${i} ${"x".repeat(120)}`,
    })),
    ...overrides,
  };
}

describe("escapeExcerpt", () => {
  it("escapes inline markdown and wraps URLs without escaping them", () => {
    expect(escapeExcerpt("**gras** voir https://a.com/x_y")).toBe(
      "\\*\\*gras\\*\\* voir <https://a.com/x_y>",
    );
  });
});

describe("messageLink", () => {
  it("builds a jump link to the message", () => {
    expect(messageLink("g1", "c1", "m1")).toBe("https://discord.com/channels/g1/c1/m1");
  });
});

describe("renderStatsPage", () => {
  it("shows the summary on page 0", () => {
    const { content } = renderStatsPage(makeReport(3, { term: "rust", termOccurrences: 5 }), 0);
    expect(content).toContain("**Stats #veille** - du 20/10/2026 au 19/11/2026");
    expect(content).toContain("Filtres : terme « rust »");
    expect(content).toContain("**3 messages** sur 500 analysés, « rust » apparaît 5 fois");
    expect(content).toContain("1. alice - 3 messages, 1 lien");
    expect(content).toContain("1. github.com - 4 liens");
  });

  it("warns when the fetch limit was reached", () => {
    const { content } = renderStatsPage(makeReport(1, { truncated: true }), 0);
    expect(content).toContain("Limite de");
  });

  it("lists messages with jump links on the following pages", () => {
    const { content, components } = renderStatsPage(makeReport(3), 1);
    expect(content).toContain("page 2/2");
    expect(content).toContain("**12/11/26** *alice* : Message numéro 0");
    expect(content).toContain("[voir](<https://discord.com/channels/g1/c1/m0>)");
    expect(JSON.stringify(components)).toContain("stats_page:abc123:0");
  });

  it("splits messages across pages under the Discord length limit, without duplicates", () => {
    const report = makeReport(40);
    const first = renderStatsPage(report, 0).content;
    const totalPages = Number(/page 1\/(\d+)/.exec(first)?.[1]);
    expect(totalPages).toBeGreaterThan(2);

    const seen: string[] = [];
    for (let p = 1; p < totalPages; p++) {
      const { content } = renderStatsPage(report, p);
      expect(content.length).toBeLessThanOrEqual(2000);
      seen.push(...[...content.matchAll(/numéro (\d+)/g)].map((m) => m[1] ?? ""));
    }
    expect(seen).toEqual(Array.from({ length: 40 }, (_, i) => String(i)));
  });

  it("has no navigation when nothing matched", () => {
    const { content, components } = renderStatsPage(
      makeReport(0, { topAuthors: [], topDomains: [] }),
      0,
    );
    expect(content).toContain("**0 message** sur 500");
    expect(components).toEqual([]);
  });
});
