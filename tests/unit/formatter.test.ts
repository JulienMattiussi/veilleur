import { describe, it, expect } from "vitest";
import {
  formatReport,
  formatReportWithCount,
  computePageStarts,
  buildSelectComponents,
  formatCuratedList,
} from "@/lib/formatter";
import type { SummarizedLink } from "@/lib/summarizer";
import { config } from "@/lib/config";

function makeLink(i: number, domain = "example.com"): SummarizedLink {
  return {
    url: `https://${domain}/article-${i}`,
    messageId: String(i),
    author: "alice",
    timestamp: "2024-04-01T10:00:00.000Z",
    context: "",
    title: `Article ${i}`,
    summary: "",
    tags: [],
    emoji: "",
  };
}

function makeLinks(count: number): SummarizedLink[] {
  return Array.from({ length: count }, (_, i) => makeLink(i + 1));
}

describe("formatReport", () => {
  it("includes total link count in header", () => {
    const result = formatReport(makeLinks(3), "7j", "7 derniers jours");
    expect(result).toContain("3 lien(s)");
  });

  it("does not show page label when all links fit on one page", () => {
    const result = formatReport(makeLinks(3), "7j", "7 derniers jours");
    expect(result).not.toContain("page");
  });

  it("shows page label when links exceed linksPerPage", () => {
    const links = makeLinks(config.report.linksPerPage + 1);
    const result = formatReport(links, "7j", "7 derniers jours");
    expect(result).toContain("page 1/2");
  });

  it("numbers entries starting from 1 on page 0", () => {
    const result = formatReport(makeLinks(3), "7j", "7 derniers jours");
    expect(result).toContain("1.");
    expect(result).toContain("2.");
    expect(result).toContain("3.");
  });

  it("numbers entries with absolute index on page 1", () => {
    const links = makeLinks(config.report.linksPerPage + 2);
    const result = formatReport(links, "7j", "7 derniers jours", 1);
    expect(result).toContain(`${config.report.linksPerPage + 1}.`);
  });

  it("shows only the current page's links", () => {
    const links = makeLinks(config.report.linksPerPage + 1);
    const page0 = formatReport(links, "7j", "7 derniers jours", 0);
    const page1 = formatReport(links, "7j", "7 derniers jours", 1);
    expect(page0).toContain("[Article 1]");
    expect(page0).not.toContain(`[Article ${config.report.linksPerPage + 1}]`);
    expect(page1).toContain(`[Article ${config.report.linksPerPage + 1}]`);
    expect(page1).not.toContain("[Article 1]");
  });

  it("groups links by domain", () => {
    const links = [
      makeLink(1, "github.com"),
      makeLink(2, "github.com"),
      makeLink(3, "blog.example.com"),
    ];
    const result = formatReport(links, "7j", "7 derniers jours");
    expect(result).toContain("**github.com**");
    expect(result).toContain("**blog.example.com**");
  });
});

describe("buildSelectComponents", () => {
  it("returns only the select row when single page and empty basket", () => {
    const components = buildSelectComponents(makeLinks(3), "ch1", "7j");
    expect(components).toHaveLength(1);
  });

  it("adds a nav buttons row when total links exceed linksPerPage", () => {
    const links = makeLinks(config.report.linksPerPage + 1);
    const components = buildSelectComponents(links, "ch1", "7j");
    expect(components).toHaveLength(2);
  });

  it("shows Valider button when basketCount > 0", () => {
    const components = buildSelectComponents(makeLinks(3), "ch1", "7j", 0, 2) as Array<{
      components: Array<{ label?: string }>;
    }>;
    const buttons = components[1]?.components ?? [];
    expect(buttons.some((b) => b.label?.startsWith("Valider"))).toBe(true);
  });

  it("Valider button label reflects basket count", () => {
    const components = buildSelectComponents(makeLinks(3), "ch1", "7j", 0, 3) as Array<{
      components: Array<{ label?: string }>;
    }>;
    const buttons = components[1]?.components ?? [];
    const valider = buttons.find((b) => b.label?.startsWith("Valider"));
    expect(valider?.label).toBe("Valider (3 liens)");
  });

  it("uses absolute indices as option values on page 1", () => {
    const links = makeLinks(config.report.linksPerPage + 2);
    const components = buildSelectComponents(links, "ch1", "7j", 1) as Array<{
      components: Array<{ options?: Array<{ value: string }> }>;
    }>;
    const options = components[0]?.components[0]?.options ?? [];
    expect(options[0]?.value).toBe(String(config.report.linksPerPage));
  });

  it("prefixes option labels with 1-based index on page 0", () => {
    const components = buildSelectComponents(makeLinks(3), "ch1", "7j", 0) as Array<{
      components: Array<{ options?: Array<{ label: string }> }>;
    }>;
    const options = components[0]?.components[0]?.options ?? [];
    expect(options[0]?.label).toMatch(/^1\. /);
    expect(options[2]?.label).toMatch(/^3\. /);
  });

  it("prefixes option labels with absolute 1-based index on page 1", () => {
    const links = makeLinks(config.report.linksPerPage + 2);
    const components = buildSelectComponents(links, "ch1", "7j", 1) as Array<{
      components: Array<{ options?: Array<{ label: string }> }>;
    }>;
    const options = components[0]?.components[0]?.options ?? [];
    expect(options[0]?.label).toMatch(new RegExp(`^${config.report.linksPerPage + 1}\\.`));
  });

  it("disables Précédent on first page", () => {
    const links = makeLinks(config.report.linksPerPage + 1);
    const components = buildSelectComponents(links, "ch1", "7j", 0) as Array<{
      components: Array<{ label?: string; disabled?: boolean }>;
    }>;
    const prev = components[1]?.components.find((b) => b.label === "◀ Précédent");
    expect(prev?.disabled).toBe(true);
  });

  it("disables Suivant on last page", () => {
    const links = makeLinks(config.report.linksPerPage + 1);
    const totalPages = Math.ceil(links.length / config.report.linksPerPage);
    const components = buildSelectComponents(links, "ch1", "7j", totalPages - 1) as Array<{
      components: Array<{ label?: string; disabled?: boolean }>;
    }>;
    const next = components[1]?.components.find((b) => b.label === "Suivant ▶");
    expect(next?.disabled).toBe(true);
  });
});

describe("formatCuratedList", () => {
  it("uses default headline when none provided", () => {
    const result = formatCuratedList(makeLinks(2));
    expect(result).toMatch(/\*\*Veille de .+\*\*/);
  });

  it("uses provided headline", () => {
    const result = formatCuratedList(makeLinks(2), "En mai, veille ce qu'il te plait");
    expect(result).toContain("**En mai, veille ce qu'il te plait**");
  });

  it("renders each link as [text](url) bullet", () => {
    const link = { ...makeLink(1), summary: "Un super article" };
    const result = formatCuratedList([link]);
    expect(result).toContain("- [Un super article](https://example.com/article-1)");
  });

  it("falls back to context when summary is empty", () => {
    const link = { ...makeLink(1), summary: "", context: "Partagé dans #tech" };
    const result = formatCuratedList([link]);
    expect(result).toContain("[Partagé dans #tech]");
  });

  it("falls back to display title when summary and context are empty", () => {
    const result = formatCuratedList([makeLink(1)]);
    expect(result).toContain("[Article 1]");
  });

  it("includes emoji before link when present", () => {
    const link = { ...makeLink(1), summary: "Un article", emoji: ":traffic_light:" };
    const result = formatCuratedList([link]);
    expect(result).toContain("- :traffic_light: [Un article]");
  });

  it("includes a code block for easy copy-paste", () => {
    const result = formatCuratedList(makeLinks(2));
    expect(result).toContain("```");
  });
});

describe("formatReportWithCount", () => {
  it("returns renderedCount equal to number of links when all fit", () => {
    const links = makeLinks(3);
    const pageStarts = computePageStarts(links, "7 derniers jours");
    const { renderedCount } = formatReportWithCount(
      links,
      "7j",
      "7 derniers jours",
      0,
      0,
      pageStarts.length,
    );
    expect(renderedCount).toBe(3);
  });

  it("returns content identical to formatReport", () => {
    const links = makeLinks(5);
    const pageStarts = computePageStarts(links, "7 derniers jours");
    const { content } = formatReportWithCount(
      links,
      "7j",
      "7 derniers jours",
      0,
      0,
      pageStarts.length,
    );
    expect(content).toBe(formatReport(links, "7j", "7 derniers jours"));
  });

  it("limits renderedCount when maxMessageLength is exceeded", () => {
    const shortMax = 200;
    const originalMax = config.report.maxMessageLength;
    config.report.maxMessageLength = shortMax;
    const links = makeLinks(10);
    const pageStarts = computePageStarts(links, "7 derniers jours");
    const { renderedCount } = formatReportWithCount(
      links,
      "7j",
      "7 derniers jours",
      0,
      0,
      pageStarts.length,
    );
    config.report.maxMessageLength = originalMax;
    expect(renderedCount).toBeGreaterThan(0);
    expect(renderedCount).toBeLessThan(10);
  });

  it("page 2 starts at the first link not shown on page 1", () => {
    const shortMax = 200;
    const originalMax = config.report.maxMessageLength;
    config.report.maxMessageLength = shortMax;
    const links = makeLinks(10);
    const pageStarts = computePageStarts(links, "7 derniers jours");
    // page 2 must start exactly where page 1 left off - no gap
    const { renderedCount: p1Count } = formatReportWithCount(
      links,
      "7j",
      "7 derniers jours",
      pageStarts[0] ?? 0,
      0,
      pageStarts.length,
    );
    config.report.maxMessageLength = originalMax;
    expect(pageStarts.length).toBeGreaterThan(1);
    expect(pageStarts[1]).toBe(p1Count);
  });
});
