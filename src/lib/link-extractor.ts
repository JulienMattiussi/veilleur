import type { DiscordMessage } from "@/lib/discord";
import { config } from "@/lib/config";

export type ExtractedLink = {
  url: string;
  messageId: string;
  author: string;
  timestamp: string;
  context: string;
};

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

function isIgnored(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return config.ignoredDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
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
