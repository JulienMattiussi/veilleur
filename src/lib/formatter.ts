import type { SummarizedLink } from "@/lib/summarizer";
import { config } from "@/lib/config";

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "autre";
  }
}

function shortTitle(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const first = pathname.split("/").filter(Boolean)[0];
    return first ? `${host}/${first}` : host;
  } catch {
    return url.slice(0, 60);
  }
}

function renderEntry(l: SummarizedLink, index: number): string {
  const tags = l.tags.length > 0 ? " " + l.tags.map((t) => `\`${t}\``).join(" ") : "";
  const description = l.summary || l.context;
  const body = description ? `\n  ${description}` : "";
  const displayTitle = l.title === l.url ? shortTitle(l.url) : l.title;
  const date = new Date(l.timestamp).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  return `${index}. **[${displayTitle}](<${l.url}>)** - ${date} *(${l.author})*${body}${tags}`;
}

export function formatReport(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
): string {
  const visible = links.slice(0, config.report.maxLinksDisplayed);
  const header = `**Veille - ${periodLbl}** - ${links.length} lien(s)\n`;

  // Group by domain, preserving order of first appearance
  const groups = new Map<string, SummarizedLink[]>();
  for (const l of visible) {
    const d = domain(l.url);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(l);
  }

  let body = "";
  let index = 1;
  let displayed = 0;

  for (const [d, groupLinks] of groups) {
    const groupHeader = `\n**${d}**`;
    const entries = groupLinks.map((l) => renderEntry(l, index++)).join("\n");
    const next = body + groupHeader + "\n" + entries;
    const remaining = links.length - displayed - groupLinks.length;
    const nextFooter = remaining > 0 ? `\n*...et ${remaining} autre(s) non affiché(s)*` : "";
    if ((header + next + nextFooter).length > config.report.maxMessageLength) break;
    body = next;
    displayed += groupLinks.length;
  }

  const finalFooter = links.length - displayed > 0
    ? `\n*...et ${links.length - displayed} autre(s) non affiché(s)*`
    : "";

  return (header + body + finalFooter).trim();
}
