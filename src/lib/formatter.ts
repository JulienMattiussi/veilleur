import type { SummarizedLink } from "@/lib/summarizer";

const DISCORD_MAX_LENGTH = 1900;

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
const MAX_LINKS_DISPLAYED = 15;

export function formatReport(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
): string {
  const header = `**Veille - ${periodLbl}** - ${links.length} lien(s)\n`;

  const entries = links.slice(0, MAX_LINKS_DISPLAYED).map((l) => {
    const tags = l.tags.length > 0 ? " " + l.tags.map((t) => `\`${t}\``).join(" ") : "";
    const description = l.summary || l.context;
    const body = description ? `\n${description}` : "";
    // When no title from Claude, derive a short one from the URL (hostname + first path segment)
    const displayTitle =
      l.title === l.url ? shortTitle(l.url) : l.title;
    return `**[${displayTitle}](<${l.url}>)**${body}${tags}`;
  });

  const footer =
    links.length > MAX_LINKS_DISPLAYED
      ? `\n*...et ${links.length - MAX_LINKS_DISPLAYED} autre(s) non affiché(s)*`
      : "";

  let body = "";
  for (const entry of entries) {
    const next = body + "\n" + entry;
    if ((header + next + footer).length > DISCORD_MAX_LENGTH) break;
    body = next;
  }

  return (header + body + footer).trim();
}
