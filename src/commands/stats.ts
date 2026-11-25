import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { fetchAllMessagesInPeriod, editFollowUp, displayName } from "@/lib/discord";
import { getCachedStats, setCachedStats } from "@/lib/cache";
import { resolveDateRange } from "@/lib/date-range";
import { computeStats, type StatsReport } from "@/lib/stats";
import { renderStatsPage } from "@/lib/stats-formatter";
import { config } from "@/lib/config";
import {
  type InteractionBody,
  ephemeralMessage,
  getStringOption,
  updateMessage,
} from "@/lib/interactions";

// custom_id format: stats_page:<reportId>:<page>
export async function handleStatsComponent(body: InteractionBody): Promise<NextResponse | null> {
  const [action, id, page] = (body.data?.custom_id ?? "").split(":");
  if (action !== "stats_page" || !id) return null;

  const report = await getCachedStats(id);
  if (!report) {
    return ephemeralMessage("Les stats ont expiré - relance `/stats` pour les recalculer.");
  }
  const { content, components } = renderStatsPage(report, parseInt(page ?? "0", 10));
  return updateMessage(content, components);
}

export async function processStatsCommand(body: InteractionBody): Promise<void> {
  const { token, application_id } = body;
  if (!token || !application_id) return;

  const channelId = getStringOption(body, "canal");
  const authorId = getStringOption(body, "auteur");
  const term = getStringOption(body, "terme");

  if (!channelId) {
    await editFollowUp(application_id, token, "Canal non spécifié.");
    return;
  }

  const range = resolveDateRange(getStringOption(body, "début"), getStringOption(body, "fin"));
  if ("error" in range) {
    await editFollowUp(application_id, token, range.error);
    return;
  }

  try {
    const { messages, truncated } = await fetchAllMessagesInPeriod(channelId, range.since, {
      until: range.until,
      maxPages: config.stats.maxPages,
    });

    const resolved = body.data?.resolved;
    const author = authorId ? resolved?.users?.[authorId] : undefined;
    const report: StatsReport = {
      id: randomUUID().slice(0, 8),
      guildId: body.guild_id ?? "@me",
      channelId,
      channelName: resolved?.channels?.[channelId]?.name,
      authorName: authorId ? (author ? displayName(author) : authorId) : undefined,
      term,
      startLabel: range.startLabel,
      endLabel: range.endLabel,
      scannedCount: messages.length,
      truncated,
      ...computeStats(messages, { authorId, term }),
    };

    await setCachedStats(report);
    const { content, components } = renderStatsPage(report, 0);
    await editFollowUp(application_id, token, content, components);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur inconnue";
    await editFollowUp(application_id, token, `Erreur : ${message}`);
  }
}
