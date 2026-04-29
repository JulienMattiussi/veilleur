import type { WatchReport } from "@/lib/summarizer";
import { config } from "@/lib/config";

declare global {
  var _localStore: Map<string, string> | undefined;
}

function getLocalStore(): Map<string, string> {
  if (!global._localStore) global._localStore = new Map();
  return global._localStore;
}

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  const { default: Redis } = await import("ioredis");
  return new Redis(process.env.REDIS_URL);
}

function reportKey(channelId: string, period: string): string {
  return `report:${channelId}:${period}`;
}

export async function getCachedReport(
  channelId: string,
  period: string,
): Promise<WatchReport | null> {
  const key = reportKey(channelId, period);
  const redis = await getRedis();

  if (redis) {
    const raw = await redis.get(key);
    await redis.quit();
    return raw ? (JSON.parse(raw) as WatchReport) : null;
  }

  const raw = getLocalStore().get(key);
  return raw ? (JSON.parse(raw) as WatchReport) : null;
}

export async function setCachedReport(report: WatchReport): Promise<void> {
  const key = reportKey(report.channelId, report.period);
  const raw = JSON.stringify(report);
  const redis = await getRedis();

  if (redis) {
    await redis.set(key, raw, "EX", config.report.cacheTtlSeconds);
    await redis.quit();
    return;
  }

  getLocalStore().set(key, raw);
}
