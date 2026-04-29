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
  page = 0,
  basketCount = 0,
): unknown[] {
  const totalPages = Math.ceil(links.length / config.report.linksPerPage);
  const pageLinks = links.slice(
    page * config.report.linksPerPage,
    (page + 1) * config.report.linksPerPage,
  );

  const options = pageLinks.map((l, i) => {
    const absoluteIndex = page * config.report.linksPerPage + i;
    const label = getDisplayTitle(l).slice(0, 100);
    const date = new Date(l.timestamp).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
    const description = `${domain(l.url)} - ${date} (${l.author})`.slice(0, 100);
    return { label, value: String(absoluteIndex), description };
  });

  const components: unknown[] = [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 3, // STRING_SELECT
          custom_id: `veille_select:${channelId}:${period}`,
          placeholder: "Sélectionne les liens à garder",
          min_values: 1,
          max_values: Math.min(config.report.maxSelectedLinks, options.length),
          options,
        },
      ],
    },
  ];

  const buttons: unknown[] = [];

  if (totalPages > 1) {
    buttons.push(
      {
        type: 2, // BUTTON
        style: 2, // SECONDARY
        label: "◀ Précédent",
        custom_id: `veille_page:${channelId}:${period}:${page - 1}`,
        disabled: page === 0,
      },
      {
        type: 2,
        style: 2,
        label: "Suivant ▶",
        custom_id: `veille_page:${channelId}:${period}:${page + 1}`,
        disabled: page === totalPages - 1,
      },
    );
  }

  if (basketCount > 0) {
    buttons.push({
      type: 2,
      style: 1, // PRIMARY
      label: `Valider (${basketCount} lien${basketCount > 1 ? "s" : ""})`,
      custom_id: `veille_validate:${channelId}:${period}`,
    });
  }

  if (buttons.length > 0) {
    components.push({ type: 1, components: buttons });
  }

  return components;
}

export function formatCuratedList(links: SummarizedLink[]): string {
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const lines = links.map((l) => `- [${getDisplayTitle(l)}](<${l.url}>)`).join("\n");
  return `**Veille de ${month}**\n${lines}`;
}

export function formatReport(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
  page = 0,
): string {
  const totalPages = Math.ceil(links.length / config.report.linksPerPage);
  const pageLinks = links.slice(
    page * config.report.linksPerPage,
    (page + 1) * config.report.linksPerPage,
  );

  const pageLabel = totalPages > 1 ? ` - page ${page + 1}/${totalPages}` : "";
  const header = `**Veille - ${periodLbl}**${pageLabel} - ${links.length} lien(s)\n`;

  // Group by domain within the page, preserving order of first appearance
  const groups = new Map<string, SummarizedLink[]>();
  for (const l of pageLinks) {
    const d = domain(l.url);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(l);
  }

  let body = "";
  let index = page * config.report.linksPerPage + 1;

  for (const [d, groupLinks] of groups) {
    const groupHeader = `\n**${d}**`;
    const entries = groupLinks.map((l) => renderEntry(l, index++)).join("\n");
    const next = body + groupHeader + "\n" + entries;
    if ((header + next).length > config.report.maxMessageLength) break;
    body = next;
  }

  return (header + body).trim();
}
