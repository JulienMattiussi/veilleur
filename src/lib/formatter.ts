import type { SummarizedLink } from "@/lib/summarizer";

const DISCORD_MAX_LENGTH = 1900;
const MAX_LINKS_DISPLAYED = 15;

export function formatReport(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
): string {
  const header = `**Veille - ${periodLbl}** - ${links.length} lien(s)\n`;

  const entries = links.slice(0, MAX_LINKS_DISPLAYED).map((l) => {
    const tags = l.tags.length > 0 ? " " + l.tags.map((t) => `\`${t}\``).join(" ") : "";
    return `**[${l.title}](<${l.url}>)**\n${l.summary}${tags}`;
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
