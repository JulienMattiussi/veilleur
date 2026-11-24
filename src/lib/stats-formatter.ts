import type { StatsMessage, StatsReport } from "@/lib/stats";
import { config } from "@/lib/config";
import { computePageStarts, buildNavButtons } from "@/lib/pagination";

const URL_SPLIT = /(https?:\/\/[^\s<>"']+)/;

// Escapes inline markdown in user content and wraps URLs in <> to avoid embeds.
export function escapeExcerpt(text: string): string {
  return text
    .split(URL_SPLIT)
    .map((part, i) => (i % 2 === 1 ? `<${part}>` : part.replace(/([\\*_~`|[\]<>])/g, "\\$1")))
    .join("");
}

export function messageLink(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString("fr-FR")} ${word}${count > 1 ? "s" : ""}`;
}

function formatShortDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    timeZone: config.stats.timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function header(report: StatsReport, page: number, totalPages: number): string {
  const channel = report.channelName ? `#${report.channelName}` : "canal";
  const pageLabel = totalPages > 1 ? ` - page ${page + 1}/${totalPages}` : "";
  const filters = [
    report.authorName ? `auteur ${report.authorName}` : null,
    report.term ? `terme « ${escapeExcerpt(report.term)} »` : null,
  ].filter(Boolean);
  const filtersLine = filters.length > 0 ? `\nFiltres : ${filters.join(", ")}` : "";
  return `**Stats ${channel}** - du ${report.startLabel} au ${report.endLabel}${pageLabel}${filtersLine}\n`;
}

function renderSummary(report: StatsReport): string {
  const lines: string[] = [];
  let counts = `**${plural(report.messages.length, "message")}** sur ${report.scannedCount.toLocaleString("fr-FR")} analysés`;
  if (report.term) {
    counts += `, « ${escapeExcerpt(report.term)} » apparaît ${report.termOccurrences.toLocaleString("fr-FR")} fois`;
  }
  lines.push(counts);
  if (report.truncated) {
    const max = (config.stats.maxPages * 100).toLocaleString("fr-FR");
    lines.push(`⚠️ Limite de ${max} messages atteinte : seule la fin de la période est couverte.`);
  }
  if (report.topAuthors.length > 0) {
    lines.push("", "**Auteurs**");
    report.topAuthors.forEach((a, i) =>
      lines.push(
        `${i + 1}. ${a.name} - ${plural(a.messages, "message")}, ${plural(a.links, "lien")}`,
      ),
    );
  }
  if (report.topDomains.length > 0) {
    lines.push("", "**Domaines partagés**");
    report.topDomains.forEach((d, i) =>
      lines.push(`${i + 1}. ${d.domain} - ${plural(d.links, "lien")}`),
    );
  }
  return lines.join("\n");
}

function renderMessage(report: StatsReport, m: StatsMessage): string {
  const link = messageLink(report.guildId, report.channelId, m.id);
  return `**${formatShortDate(m.timestamp)}** *${m.author}* : ${escapeExcerpt(m.excerpt)} [voir](<${link}>)`;
}

// How many messages fit on a page starting at `start`, under the Discord length limit.
function fitMessages(report: StatsReport, start: number, headerText: string): number {
  let length = headerText.length;
  let count = 0;
  for (const m of report.messages.slice(start)) {
    length += renderMessage(report, m).length + 1;
    if (length > config.report.maxMessageLength) break;
    count++;
  }
  return count;
}

// Page 0 is the summary, the following pages list the matching messages.
function messagePageStarts(report: StatsReport): number[] {
  const worstHeader = header(report, 98, 99);
  return computePageStarts(report.messages.length, (start) =>
    fitMessages(report, start, worstHeader),
  );
}

export function renderStatsPage(
  report: StatsReport,
  page: number,
): { content: string; components: unknown[] } {
  const starts = messagePageStarts(report);
  const totalPages = 1 + starts.length;
  const current = Math.min(Math.max(page, 0), totalPages - 1);
  const head = header(report, current, totalPages);

  let body: string;
  if (current === 0) {
    body = renderSummary(report);
  } else {
    const start = starts[current - 1] ?? 0;
    const count = fitMessages(report, start, head);
    body = report.messages
      .slice(start, start + count)
      .map((m) => renderMessage(report, m))
      .join("\n");
  }

  const buttons = buildNavButtons(current, totalPages, (p) => `stats_page:${report.id}:${p}`);
  return {
    content: `${head}\n${body}`.slice(0, 2000),
    components: buttons.length > 0 ? [{ type: 1, components: buttons }] : [],
  };
}
