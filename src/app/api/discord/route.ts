import { NextRequest, NextResponse, after } from "next/server";
import { verifyDiscordSignature, fetchAllMessagesInPeriod, editFollowUp } from "@/lib/discord";
import { extractLinks } from "@/lib/link-extractor";
import { summarizeLinks } from "@/lib/summarizer";
import { getCachedReport, setCachedReport } from "@/lib/cache";
import { parsePeriod, periodLabel } from "@/lib/period";
import { formatReport } from "@/lib/formatter";

const PING = 1;
const APPLICATION_COMMAND = 2;

const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;

type InteractionOption = { name: string; value: unknown };

type InteractionBody = {
  type: number;
  token?: string;
  application_id?: string;
  data?: {
    name: string;
    options?: InteractionOption[];
  };
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";
  if (!verifyDiscordSignature(rawBody, signature, timestamp, publicKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as InteractionBody;

  if (body.type === PING) {
    return NextResponse.json({ type: PONG });
  }

  if (body.type === APPLICATION_COMMAND && body.data?.name === "veille") {
    after(processVeilleCommand(body));
    return NextResponse.json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64 } });
  }

  return NextResponse.json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Commande inconnue." } });
}

async function processVeilleCommand(body: InteractionBody): Promise<void> {
  const { token, application_id, data } = body;
  if (!token || !application_id) return;

  const options = data?.options ?? [];
  const channelId = options.find((o) => o.name === "canal")?.value as string | undefined;
  const period = (options.find((o) => o.name === "période")?.value as string | undefined) ?? "7j";

  if (!channelId) {
    await editFollowUp(application_id, token, "Canal non spécifié.");
    return;
  }

  try {
    const cached = await getCachedReport(channelId, period);
    if (cached) {
      await editFollowUp(application_id, token, formatReport(cached.links, period, periodLabel(period)));
      return;
    }

    const sinceDate = parsePeriod(period);
    const messages = await fetchAllMessagesInPeriod(channelId, sinceDate);
    const links = extractLinks(messages);

    if (links.length === 0) {
      await editFollowUp(
        application_id,
        token,
        `Aucun lien trouvé dans ce canal sur les ${periodLabel(period)}.`,
      );
      return;
    }

    const summarized = await summarizeLinks(links);

    await setCachedReport({
      channelId,
      period,
      generatedAt: new Date().toISOString(),
      links: summarized,
    });

    await editFollowUp(application_id, token, formatReport(summarized, period, periodLabel(period)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur inconnue";
    await editFollowUp(application_id, token, `Erreur : ${message}`);
  }
}
