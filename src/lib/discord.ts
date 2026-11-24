import nacl from "tweetnacl";
import { config } from "@/lib/config";

export class DiscordVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordVerificationError";
  }
}

export function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): boolean {
  try {
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, "hex");
    const key = Buffer.from(publicKey, "hex");
    return nacl.sign.detached.verify(
      new Uint8Array(message),
      new Uint8Array(sig),
      new Uint8Array(key),
    );
  } catch {
    return false;
  }
}

const DISCORD_API = config.discord.apiBase;

export type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username: string; bot?: boolean };
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  channelId: string,
  beforeId: string,
  limit = 100,
): Promise<DiscordMessage[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const url = `${DISCORD_API}/channels/${channelId}/messages?before=${beforeId}&limit=${limit}`;

  for (let attempt = 0; attempt < config.discord.rateLimitRetries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = parseFloat(res.headers.get("retry-after") ?? "1");
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<DiscordMessage[]>;
  }

  throw new Error("Discord API error: too many rate limit retries");
}

export async function editFollowUp(
  applicationId: string,
  token: string,
  content: string,
  components?: unknown[],
): Promise<void> {
  const url = `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    // Never ping anyone: reports quote user content that may contain mentions.
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
      ...(components ? { components } : {}),
    }),
  });
}

function toSnowflake(date: Date): bigint {
  // Discord snowflake: shift timestamp left by 22 bits after subtracting Discord epoch (2015-01-01)
  const DISCORD_EPOCH = 1420070400000n;
  return (BigInt(date.getTime()) - DISCORD_EPOCH) << 22n;
}

export type FetchOptions = {
  // End of the period (exclusive), defaults to now
  until?: Date;
  maxPages?: number;
};

// Returns the messages posted in [sinceDate, until), oldest first.
// `truncated` is true when maxPages was reached before the start of the period.
export async function fetchAllMessagesInPeriod(
  channelId: string,
  sinceDate: Date,
  { until, maxPages = config.discord.maxPages }: FetchOptions = {},
): Promise<{ messages: DiscordMessage[]; truncated: boolean }> {
  // Paginate backwards from the end of the period so recent messages are always captured first.
  const sinceSnowflake = toSnowflake(sinceDate);
  const end = until && until.getTime() < Date.now() ? until : new Date();

  const all: DiscordMessage[] = [];
  let beforeId = toSnowflake(end).toString();

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(config.discord.pageDelayMs);
    const batch = await fetchPage(channelId, beforeId, 100);
    if (batch.length === 0) return { messages: all.reverse(), truncated: false };

    // Discard messages older than sinceDate and stop pagination
    const inRange = batch.filter((m) => BigInt(m.id) >= sinceSnowflake);
    all.push(...inRange);

    if (inRange.length < batch.length || batch.length < 100) {
      return { messages: all.reverse(), truncated: false };
    }

    beforeId = batch[batch.length - 1]!.id; // oldest message in batch
  }

  return { messages: all.reverse(), truncated: true };
}
