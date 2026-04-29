import type { SummarizedLink } from "@/lib/summarizer";
import { config } from "@/lib/config";

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
export function formatReport(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
): string {
  const header = `**Veille - ${periodLbl}** - ${links.length} lien(s)\n`;

  const entries = links.slice(0, config.report.maxLinksDisplayed).map((l) => {
    const tags = l.tags.length > 0 ? " " + l.tags.map((t) => `\`${t}\``).join(" ") : "";
    const description = l.summary || l.context;
    const body = description ? `\n${description}` : "";
    // When no title from Claude, derive a short one from the URL (hostname + first path segment)
    const displayTitle =
      l.title === l.url ? shortTitle(l.url) : l.title;
    return `**[${displayTitle}](<${l.url}>)**${body}${tags}`;
  });

  const footer =
    links.length > config.report.maxLinksDisplayed
      ? `\n*...et ${links.length - config.report.maxLinksDisplayed} autre(s) non affiché(s)*`
      : "";

  let body = "";
  for (const entry of entries) {
    const next = body + "\n" + entry;
    if ((header + next + footer).length > config.report.maxMessageLength) break;
    body = next;
  }

  return (header + body + footer).trim();
}
