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

function renderPageFrom(
  links: SummarizedLink[],
  startIndex: number,
  header: string,
): { body: string; renderedCount: number } {
  const pageLinks = links.slice(startIndex, startIndex + config.report.linksPerPage);

  let body = "";
  let index = startIndex + 1;
  let renderedCount = 0;
  const seenDomains = new Set<string>();

  for (const l of pageLinks) {
    const d = domain(l.url);
    const domainPrefix = seenDomains.has(d) ? "\n" : `\n**${d}**\n`;
    const candidate = body + domainPrefix + renderEntry(l, index);
    if ((header + candidate).length > config.report.maxMessageLength) break;
    body = candidate;
    seenDomains.add(d);
    index++;
    renderedCount++;
  }

  return { body, renderedCount };
}

// Returns the start index of each page, computed from the actual rendered size of each page.
export function computePageStarts(links: SummarizedLink[], periodLbl: string): number[] {
  const starts: number[] = [];
  let i = 0;
  // Use a worst-case page label (" - page 99/99" = 14 chars) so renderedCount is never
  // larger than what formatReportWithCount will actually render, avoiding cross-page duplicates.
  const approxHeader = `**Veille - ${periodLbl}** - page 99/99 - ${links.length} lien(s)\n`;
  while (i < links.length) {
    starts.push(i);
    const { renderedCount } = renderPageFrom(links, i, approxHeader);
    if (renderedCount === 0) break;
    i += renderedCount;
  }
  return starts;
}

export function buildSelectComponents(
  links: SummarizedLink[],
  channelId: string,
  period: string,
  page = 0,
  basketCount = 0,
  renderedCount?: number,
  pageStarts?: number[],
): unknown[] {
  const totalPages = pageStarts
    ? pageStarts.length
    : Math.ceil(links.length / config.report.linksPerPage);
  const startIndex = pageStarts ? (pageStarts[page] ?? 0) : page * config.report.linksPerPage;
  const visibleLinks = links.slice(
    startIndex,
    startIndex + (renderedCount ?? config.report.linksPerPage),
  );

  const options = visibleLinks.map((l, i) => {
    const absoluteIndex = startIndex + i;
    const label = `${absoluteIndex + 1}. ${getDisplayTitle(l)}`.slice(0, 100);
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
          custom_id: `veille_select:${channelId}:${period}:${page}`,
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

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/:[a-z0-9_+-]+:/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const LETTER_EMOJIS = "abcdefghijklmnopqrstuvwxyz"
  .split("")
  .map((c) => `:regional_indicator_${c}:`);

export function formatCuratedList(links: SummarizedLink[], headline?: string): string {
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const title = headline ?? `Veille de ${month}`;
  const header = `**${title}**`;
  const lines = links
    .map((l, i) => {
      const raw = l.summary || l.context || getDisplayTitle(l);
      const text = stripMarkdown(raw);
      const emoji = l.emoji || (LETTER_EMOJIS[i % LETTER_EMOJIS.length] ?? ":white_small_square:");
      return `- ${emoji} [${text}](${l.url})`;
    })
    .join("\n");
  // Discord copies rendered text (stripped of markdown), so provide a raw code block.
  // The copy button on the block gives raw markdown that renders correctly when pasted.
  const copyBlock = `\`\`\`\n${header}\n${lines}\n\`\`\``;
  const full = `${header}\n${lines}\n${copyBlock}`;
  return full.length <= 1950 ? full : copyBlock;
}

export function formatReportWithCount(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
  startIndex: number,
  pageNumber: number,
  totalPages: number,
): { content: string; renderedCount: number } {
  const pageLabel = totalPages > 1 ? ` - page ${pageNumber + 1}/${totalPages}` : "";
  const header = `**Veille - ${periodLbl}**${pageLabel} - ${links.length} lien(s)\n`;
  const { body, renderedCount } = renderPageFrom(links, startIndex, header);
  return { content: (header + body).trim(), renderedCount };
}

export function formatReport(
  links: SummarizedLink[],
  period: string,
  periodLbl: string,
  page = 0,
): string {
  const pageStarts = computePageStarts(links, periodLbl);
  const startIndex = pageStarts[page] ?? 0;
  const totalPages = pageStarts.length;
  return formatReportWithCount(links, period, periodLbl, startIndex, page, totalPages).content;
}
