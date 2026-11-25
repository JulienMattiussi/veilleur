import { displayName, type DiscordMessage } from "@/lib/discord";
import { config } from "@/lib/config";

export type ExtractedLink = {
  url: string;
  messageId: string;
  author: string;
  timestamp: string;
  context: string;
};

export const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

// Hostname without the "www." prefix, used to group and count links by site.
export function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "autre";
  }
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff?|avif)(\?.*)?$/i;

function isIgnored(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (config.ignoredDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`)))
      return true;
    if (IMAGE_EXTENSIONS.test(pathname)) return true;
    return false;
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
      const context = msg.content.replace(URL_REGEX, "").replace(/\s+/g, " ").trim().slice(0, 200);

      links.push({
        url,
        messageId: msg.id,
        author: displayName(msg.author),
        timestamp: msg.timestamp,
        context,
      });
    }
  }

  return links;
}
