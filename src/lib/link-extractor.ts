import type { DiscordMessage } from "@/lib/discord";

export type ExtractedLink = {
  url: string;
  messageId: string;
  author: string;
  timestamp: string;
  context: string;
};

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

const IGNORED_DOMAINS = [
  "discord.com",
  "discord.gg",
  "tenor.com",
  "giphy.com",
  "klipy.com",
  "media.discordapp.net",
  "cdn.discordapp.com",
];

function isIgnored(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return IGNORED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

export function extractLinks(messages: DiscordMessage[]): ExtractedLink[] {
  const seen = new Set<string>();
  const links: ExtractedLink[] = [];

  for (const msg of messages) {
    const matches = msg.content.match(URL_REGEX) ?? [];
    for (const raw of matches) {
      const url = raw.replace(/[.,;:!?)]+$/, "");
      if (seen.has(url) || isIgnored(url)) continue;
      seen.add(url);
      const context = msg.content
        .replace(URL_REGEX, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      links.push({
        url,
        messageId: msg.id,
        author: msg.author.username,
        timestamp: msg.timestamp,
        context,
      });
    }
  }

  return links;
}
