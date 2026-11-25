import { displayName, type DiscordMessage } from "@/lib/discord";
import { extractLinks, domain } from "@/lib/link-extractor";
import { config } from "@/lib/config";

export type StatsFilters = { authorId?: string; term?: string };

export type StatsMessage = { id: string; author: string; timestamp: string; excerpt: string };

export type AuthorRank = { name: string; messages: number; links: number };

export type DomainRank = { domain: string; links: number };

export type StatsResult = {
  messages: StatsMessage[]; // most recent first
  termOccurrences: number;
  topAuthors: AuthorRank[];
  topDomains: DomainRank[];
};

// Cached /stats report, read back when the user navigates between pages.
export type StatsReport = StatsResult & {
  id: string;
  guildId: string;
  channelId: string;
  channelName?: string;
  authorName?: string;
  term?: string;
  startLabel: string;
  endLabel: string;
  scannedCount: number;
  truncated: boolean;
};

// Case-insensitive, non-overlapping substring count.
export function countOccurrences(text: string, term: string): number {
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  if (needle === "") return 0;
  let count = 0;
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    count++;
    from = haystack.indexOf(needle, from + needle.length);
  }
  return count;
}

// Single-line excerpt of the message, centered on the first occurrence of the term
// when it would otherwise be cut off.
export function makeExcerpt(
  content: string,
  term: string | undefined,
  maxLength = config.stats.excerptLength,
): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  const cutOff = term !== undefined && index > maxLength - term.length - 20;
  const start = cutOff ? Math.max(0, index - 40) : 0;
  const slice = text.slice(start, start + maxLength).trim();
  return `${start > 0 ? "…" : ""}${slice}${start + maxLength < text.length ? "…" : ""}`;
}

function topEntries<T>(
  counts: Map<string, T>,
  score: (v: T) => number,
  key: (k: string) => string,
) {
  return [...counts.entries()]
    .sort(([ka, a], [kb, b]) => score(b) - score(a) || key(ka).localeCompare(key(kb)))
    .slice(0, config.stats.topCount);
}

// Filters the messages (bots excluded) and computes the rankings. Pure function.
export function computeStats(messages: DiscordMessage[], filters: StatsFilters): StatsResult {
  const { authorId, term } = filters;
  const matches = messages.filter(
    (m) =>
      !m.author.bot &&
      (!authorId || m.author.id === authorId) &&
      (!term || countOccurrences(m.content, term) > 0),
  );

  const termOccurrences = term
    ? matches.reduce((sum, m) => sum + countOccurrences(m.content, term), 0)
    : 0;

  // Links are deduplicated across messages: a link counts once, for whoever shared it first.
  const links = extractLinks(matches);
  const authorIdByMessage = new Map(matches.map((m) => [m.id, m.author.id]));

  const authors = new Map<string, AuthorRank>();
  for (const m of matches) {
    const entry = authors.get(m.author.id) ?? {
      name: displayName(m.author),
      messages: 0,
      links: 0,
    };
    entry.messages++;
    authors.set(m.author.id, entry);
  }
  const domains = new Map<string, number>();
  for (const l of links) {
    const author = authors.get(authorIdByMessage.get(l.messageId) ?? "");
    if (author) author.links++;
    const d = domain(l.url);
    domains.set(d, (domains.get(d) ?? 0) + 1);
  }

  return {
    messages: matches
      .map((m) => ({
        id: m.id,
        author: displayName(m.author),
        timestamp: m.timestamp,
        excerpt: makeExcerpt(m.content, term),
      }))
      .reverse(),
    termOccurrences,
    topAuthors: topEntries(
      authors,
      (a) => a.messages,
      (id) => authors.get(id)?.name ?? "",
    ).map(([, a]) => a),
    topDomains: topEntries(
      domains,
      (n) => n,
      (d) => d,
    ).map(([d, n]) => ({ domain: d, links: n })),
  };
}
