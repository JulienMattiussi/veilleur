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

export function getDisplayTitle(l: SummarizedLink): string {
  return l.title === l.url ? shortTitle(l.url) : l.title;
}

export function buildSelectComponents(
  links: SummarizedLink[],
  channelId: string,
  period: string,
): unknown[] {
  const options = links.slice(0, 25).map((l, i) => {
    const label = getDisplayTitle(l).slice(0, 100);
    const date = new Date(l.timestamp).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
    const description = `${domain(l.url)} - ${date} (${l.author})`.slice(0, 100);
    return { label, value: String(i), description };
  });

  return [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 3, // STRING_SELECT
          custom_id: `veille_select:${channelId}:${period}`,
          placeholder: "Sélectionne jusqu'à 6 liens à garder",
          min_values: 1,
          max_values: Math.min(config.report.maxSelectedLinks, options.length),
          options,
        },
      ],
    },
  ];
}

export function formatCuratedList(links: SummarizedLink[]): string {
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const lines = links.map((l) => `- [${getDisplayTitle(l)}](<${l.url}>)`).join("\n");
  return `**Veille de ${month}**\n${lines}`;
}

export function formatReport(links: SummarizedLink[], period: string, periodLbl: string): string {
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

  const finalFooter =
    links.length - displayed > 0
      ? `\n*...et ${links.length - displayed} autre(s) non affiché(s)*`
      : "";

  return (header + body + finalFooter).trim();
}
