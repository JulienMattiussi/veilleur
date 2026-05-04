import type { ExtractedLink } from "@/lib/link-extractor";

export type SummarizedLink = ExtractedLink & {
  title: string;
  summary: string;
  tags: string[];
  emoji: string;
};

export type WatchReport = {
  channelId: string;
  period: string;
  generatedAt: string;
  links: SummarizedLink[];
  headline?: string;
};

function defaultHeadline(): string {
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return `Veille de ${month}`;
}

export async function summarizeLinks(
  links: ExtractedLink[],
): Promise<{ headline: string; links: SummarizedLink[] }> {
  if (links.length === 0) return { headline: defaultHeadline(), links: [] };

  if (!process.env.ANTHROPIC_API_KEY) {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    return {
      headline: defaultHeadline(),
      links: links.map((link, i) => ({
        ...link,
        title: link.url,
        summary: "",
        tags: [],
        emoji: `:regional_indicator_${letters[i % letters.length]}:`,
      })),
    };
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const urlList = links
    .map((l, i) => `${i + 1}. ${l.url}${l.context ? ` (contexte : ${l.context})` : ""}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Tu es un assistant de veille technologique. Analyse ces liens partagés dans un canal Discord tech.

Fournis :
1. Un titre accrocheur et créatif en français pour cette session de veille (jeu de mots bienvenu, ton léger).
2. Pour chaque lien :
   - un emoji Discord approprié au contenu (format :nom_emoji:)
   - un titre court (max 80 caractères)
   - un résumé accrocheur en 1-2 phrases qui donnera envie de cliquer
   - 2-4 tags thématiques en minuscules

Réponds en JSON valide avec ce format exact :
{"headline":"...","links":[{"url":"...","title":"...","summary":"...","tags":["..."],"emoji":":nom_emoji:"}]}

URLs :
${urlList}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "{}";
  const text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: {
    headline?: string;
    links?: Array<{ url: string; title: string; summary: string; tags: string[]; emoji: string }>;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  const parsedLinks = parsed.links ?? [];
  return {
    headline: parsed.headline ?? defaultHeadline(),
    links: links.map((link) => {
      const found = parsedLinks.find((p) => p.url === link.url);
      return {
        ...link,
        title: found?.title ?? link.url,
        summary: found?.summary ?? "",
        tags: found?.tags ?? [],
        emoji: found?.emoji ?? "",
      };
    }),
  };
}
