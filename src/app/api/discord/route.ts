import { NextRequest, NextResponse, after } from "next/server";
import { verifyDiscordSignature, fetchAllMessagesInPeriod, editFollowUp } from "@/lib/discord";
import { extractLinks } from "@/lib/link-extractor";
import { summarizeLinks } from "@/lib/summarizer";
import { getCachedReport, setCachedReport, getBasket, setBasket, clearBasket } from "@/lib/cache";
import { parsePeriod, periodLabel } from "@/lib/period";
import {
  computePageStarts,
  formatReportWithCount,
  buildSelectComponents,
  formatCuratedList,
} from "@/lib/formatter";
import { config } from "@/lib/config";

const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;

const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;
const UPDATE_MESSAGE = 7;

type InteractionOption = { name: string; value: unknown };

type InteractionBody = {
  type: number;
  token?: string;
  application_id?: string;
  member?: { user: { id: string } };
  user?: { id: string };
  data?: {
    name?: string;
    options?: InteractionOption[];
    custom_id?: string;
    values?: string[];
  };
};

function getUserId(body: InteractionBody): string {
  return body.member?.user.id ?? body.user?.id ?? "anonymous";
}

function expiredResponse(): NextResponse {
  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: 64,
      content: "Le rapport a expiré - relance `/veille` pour en générer un nouveau.",
    },
  });
}

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

  if (body.type === MESSAGE_COMPONENT && body.data?.custom_id?.startsWith("veille_select:")) {
    return handleSelectComponent(body);
  }

  if (body.type === MESSAGE_COMPONENT && body.data?.custom_id?.startsWith("veille_page:")) {
    return handlePageComponent(body);
  }

  if (body.type === MESSAGE_COMPONENT && body.data?.custom_id?.startsWith("veille_validate:")) {
    return handleValidateComponent(body);
  }

  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Commande inconnue." },
  });
}

async function handleSelectComponent(body: InteractionBody): Promise<NextResponse> {
  const parts = (body.data?.custom_id ?? "").split(":");
  const channelId = parts[1] ?? "";
  const period = parts[2] ?? "";
  const page = parseInt(parts[3] ?? "0", 10);
  const userId = getUserId(body);
  const newIndices = (body.data?.values ?? []).map(Number);

  const cached = await getCachedReport(channelId, period);
  if (!cached) return expiredResponse();

  const pageStarts = computePageStarts(cached.links, periodLabel(period));
  const pageStart = pageStarts[page] ?? 0;
  const pageEnd = pageStarts[page + 1] ?? cached.links.length;

  const existing = await getBasket(channelId, period, userId);
  const kept = existing.filter((i) => i < pageStart || i >= pageEnd);
  const merged = [...kept, ...newIndices].slice(0, config.report.maxSelectedLinks);

  await setBasket(channelId, period, userId, merged);

  const startIndex = pageStarts[page] ?? 0;
  const { content, renderedCount } = formatReportWithCount(
    cached.links,
    period,
    periodLabel(period),
    startIndex,
    page,
    pageStarts.length,
  );
  return NextResponse.json({
    type: UPDATE_MESSAGE,
    data: {
      content,
      components: buildSelectComponents(
        cached.links,
        channelId,
        period,
        page,
        merged.length,
        renderedCount,
        pageStarts,
      ),
    },
  });
}

async function handlePageComponent(body: InteractionBody): Promise<NextResponse> {
  const parts = (body.data?.custom_id ?? "").split(":");
  const channelId = parts[1] ?? "";
  const period = parts[2] ?? "";
  const page = parseInt(parts[3] ?? "0", 10);
  const userId = getUserId(body);

  const cached = await getCachedReport(channelId, period);
  if (!cached) return expiredResponse();

  const basket = await getBasket(channelId, period, userId);
  const pageStarts = computePageStarts(cached.links, periodLabel(period));
  const startIndex = pageStarts[page] ?? 0;

  const { content, renderedCount } = formatReportWithCount(
    cached.links,
    period,
    periodLabel(period),
    startIndex,
    page,
    pageStarts.length,
  );
  return NextResponse.json({
    type: UPDATE_MESSAGE,
    data: {
      content,
      components: buildSelectComponents(
        cached.links,
        channelId,
        period,
        page,
        basket.length,
        renderedCount,
        pageStarts,
      ),
    },
  });
}

async function handleValidateComponent(body: InteractionBody): Promise<NextResponse> {
  const [, channelId, period] = (body.data?.custom_id ?? "").split(":");
  const userId = getUserId(body);

  const [cached, indices] = await Promise.all([
    getCachedReport(channelId ?? "", period ?? ""),
    getBasket(channelId ?? "", period ?? "", userId),
  ]);

  if (!cached) return expiredResponse();

  const selectedLinks = indices
    .map((i) => cached.links[i])
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

  await clearBasket(channelId ?? "", period ?? "", userId);

  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: 64,
      content: formatCuratedList(selectedLinks, cached.headline),
    },
  });
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
      const pageStarts = computePageStarts(cached.links, periodLabel(period));
      const { content, renderedCount } = formatReportWithCount(
        cached.links,
        period,
        periodLabel(period),
        pageStarts[0] ?? 0,
        0,
        pageStarts.length,
      );
      await editFollowUp(
        application_id,
        token,
        content,
        buildSelectComponents(cached.links, channelId, period, 0, 0, renderedCount, pageStarts),
      );
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

    const { headline, links: summarized } = await summarizeLinks(links);

    await setCachedReport({
      channelId,
      period,
      generatedAt: new Date().toISOString(),
      links: summarized,
      headline,
    });

    const pageStarts = computePageStarts(summarized, periodLabel(period));
    const { content, renderedCount } = formatReportWithCount(
      summarized,
      period,
      periodLabel(period),
      pageStarts[0] ?? 0,
      0,
      pageStarts.length,
    );
    await editFollowUp(
      application_id,
      token,
      content,
      buildSelectComponents(summarized, channelId, period, 0, 0, renderedCount, pageStarts),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur inconnue";
    await editFollowUp(application_id, token, `Erreur : ${message}`);
  }
}
