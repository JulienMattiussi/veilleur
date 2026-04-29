import type { ExtractedLink } from "@/lib/link-extractor";

export type SummarizedLink = ExtractedLink & {
  title: string;
  summary: string;
  tags: string[];
};

export type WatchReport = {
  channelId: string;
  period: string;
  generatedAt: string;
  links: SummarizedLink[];
};

export async function summarizeLinks(links: ExtractedLink[]): Promise<SummarizedLink[]> {
  if (links.length === 0) return [];

  if (!process.env.ANTHROPIC_API_KEY) {
    // Stub mode - returns links without summary until API key is configured
    return links.map((link) => ({ ...link, title: link.url, summary: "", tags: [] }));
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
        content: `Tu es un assistant de veille technologique. Pour chaque URL ci-dessous, fournis :
- un titre court (max 80 caractères)
- un résumé en 1-2 phrases
- 2-4 tags thématiques en minuscules (ex: ai, rust, devops, sécurité)

Réponds en JSON valide avec ce format exact :
[{"url":"...","title":"...","summary":"...","tags":["..."]}]

URLs :
${urlList}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: Array<{ url: string; title: string; summary: string; tags: string[] }>;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = [];
  }

  return links.map((link) => {
    const found = parsed.find((p) => p.url === link.url);
    return {
      ...link,
      title: found?.title ?? link.url,
      summary: found?.summary ?? "",
      tags: found?.tags ?? [],
    };
  });
}
