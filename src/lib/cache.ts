import type { WatchReport } from "@/lib/summarizer";
import type { StatsReport } from "@/lib/stats";
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

async function readJson<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  let raw: string | null | undefined;
  if (redis) {
    raw = await redis.get(key);
    await redis.quit();
  } else {
    raw = getLocalStore().get(key);
  }
  return raw ? (JSON.parse(raw) as T) : null;
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  const redis = await getRedis();
  if (redis) {
    await redis.set(key, raw, "EX", config.report.cacheTtlSeconds);
    await redis.quit();
    return;
  }
  getLocalStore().set(key, raw);
}

async function deleteKey(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(key);
    await redis.quit();
    return;
  }
  getLocalStore().delete(key);
}

function reportKey(channelId: string, period: string): string {
  return `report:${channelId}:${period}`;
}

function basketKey(channelId: string, period: string, userId: string): string {
  return `basket:${channelId}:${period}:${userId}`;
}

function statsKey(id: string): string {
  return `stats:${id}`;
}

export async function getCachedReport(
  channelId: string,
  period: string,
): Promise<WatchReport | null> {
  return readJson<WatchReport>(reportKey(channelId, period));
}

export async function setCachedReport(report: WatchReport): Promise<void> {
  await writeJson(reportKey(report.channelId, report.period), report);
}

export async function getBasket(
  channelId: string,
  period: string,
  userId: string,
): Promise<number[]> {
  return (await readJson<number[]>(basketKey(channelId, period, userId))) ?? [];
}

export async function setBasket(
  channelId: string,
  period: string,
  userId: string,
  indices: number[],
): Promise<void> {
  await writeJson(basketKey(channelId, period, userId), indices);
}

export async function clearBasket(
  channelId: string,
  period: string,
  userId: string,
): Promise<void> {
  await deleteKey(basketKey(channelId, period, userId));
}

export async function getCachedStats(id: string): Promise<StatsReport | null> {
  return readJson<StatsReport>(statsKey(id));
}

export async function setCachedStats(report: StatsReport): Promise<void> {
  await writeJson(statsKey(report.id), report);
}
