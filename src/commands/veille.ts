import { NextResponse } from "next/server";
import { fetchAllMessagesInPeriod, editFollowUp } from "@/lib/discord";
import { extractLinks } from "@/lib/link-extractor";
import { summarizeLinks, type SummarizedLink } from "@/lib/summarizer";
import { getCachedReport, setCachedReport, getBasket, setBasket, clearBasket } from "@/lib/cache";
import { parsePeriod, periodLabel } from "@/lib/period";
import {
  computePageStarts,
  formatReportWithCount,
  buildSelectComponents,
  formatCuratedList,
} from "@/lib/formatter";
import { config } from "@/lib/config";
import {
  type InteractionBody,
  CHANNEL_MESSAGE_WITH_SOURCE,
  EPHEMERAL,
  ephemeralMessage,
  getStringOption,
  getUserId,
  updateMessage,
} from "@/lib/interactions";

function expiredResponse(): NextResponse {
  return ephemeralMessage("Le rapport a expiré - relance `/veille` pour en générer un nouveau.");
}

// Renders one page of the report (text + select menu + buttons).
function renderReportPage(
  links: SummarizedLink[],
  channelId: string,
  period: string,
  page: number,
  basketCount: number,
): { content: string; components: unknown[] } {
  const pageStarts = computePageStarts(links, periodLabel(period));
  const { content, renderedCount } = formatReportWithCount(
    links,
    period,
    periodLabel(period),
    pageStarts[page] ?? 0,
    page,
    pageStarts.length,
  );
  const components = buildSelectComponents(
    links,
    channelId,
    period,
    page,
    basketCount,
    renderedCount,
    pageStarts,
  );
  return { content, components };
}

// custom_id format: veille_<action>:<channelId>:<period>[:<page>]
function parseCustomId(body: InteractionBody): { channelId: string; period: string; page: number } {
  const parts = (body.data?.custom_id ?? "").split(":");
  return {
    channelId: parts[1] ?? "",
    period: parts[2] ?? "",
    page: parseInt(parts[3] ?? "0", 10),
  };
}

export async function handleVeilleComponent(body: InteractionBody): Promise<NextResponse | null> {
  const customId = body.data?.custom_id ?? "";
  if (customId.startsWith("veille_select:")) return handleSelect(body);
  if (customId.startsWith("veille_page:")) return handlePage(body);
  if (customId.startsWith("veille_validate:")) return handleValidate(body);
  return null;
}

async function handleSelect(body: InteractionBody): Promise<NextResponse> {
  const { channelId, period, page } = parseCustomId(body);
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

  const { content, components } = renderReportPage(
    cached.links,
    channelId,
    period,
    page,
    merged.length,
  );
  return updateMessage(content, components);
}

async function handlePage(body: InteractionBody): Promise<NextResponse> {
  const { channelId, period, page } = parseCustomId(body);
  const userId = getUserId(body);

  const cached = await getCachedReport(channelId, period);
  if (!cached) return expiredResponse();

  const basket = await getBasket(channelId, period, userId);
  const { content, components } = renderReportPage(
    cached.links,
    channelId,
    period,
    page,
    basket.length,
  );
  return updateMessage(content, components);
}

async function handleValidate(body: InteractionBody): Promise<NextResponse> {
  const { channelId, period } = parseCustomId(body);
  const userId = getUserId(body);

  const [cached, indices] = await Promise.all([
    getCachedReport(channelId, period),
    getBasket(channelId, period, userId),
  ]);

  if (!cached) return expiredResponse();

  const selectedLinks = indices
    .map((i) => cached.links[i])
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

  await clearBasket(channelId, period, userId);

  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: EPHEMERAL,
      content: formatCuratedList(selectedLinks, cached.headline),
    },
  });
}

export async function processVeilleCommand(body: InteractionBody): Promise<void> {
  const { token, application_id } = body;
  if (!token || !application_id) return;

  const channelId = getStringOption(body, "canal");
  const period = getStringOption(body, "période") ?? "7j";

  if (!channelId) {
    await editFollowUp(application_id, token, "Canal non spécifié.");
    return;
  }

  try {
    const cached = await getCachedReport(channelId, period);
    if (cached) {
      const { content, components } = renderReportPage(cached.links, channelId, period, 0, 0);
      await editFollowUp(application_id, token, content, components);
      return;
    }

    const { messages } = await fetchAllMessagesInPeriod(channelId, parsePeriod(period));
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

    const { content, components } = renderReportPage(summarized, channelId, period, 0, 0);
    await editFollowUp(application_id, token, content, components);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur inconnue";
    await editFollowUp(application_id, token, `Erreur : ${message}`);
  }
}
