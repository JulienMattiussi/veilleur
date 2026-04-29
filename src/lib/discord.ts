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
  author: { username: string };
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  channelId: string,
  param: "before" | "after",
  snowflakeId: string,
  limit = 100,
): Promise<DiscordMessage[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const url = `${DISCORD_API}/channels/${channelId}/messages?${param}=${snowflakeId}&limit=${limit}`;

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
    body: JSON.stringify({ content, ...(components ? { components } : {}) }),
  });
}

export async function fetchAllMessagesInPeriod(
  channelId: string,
  sinceDate: Date,
): Promise<DiscordMessage[]> {
  // Paginate backwards from now so recent messages are always captured first.
  // Discord snowflake: shift timestamp left by 22 bits after subtracting Discord epoch (2015-01-01)
  const DISCORD_EPOCH = 1420070400000n;
  const sinceSnowflake = (BigInt(sinceDate.getTime()) - DISCORD_EPOCH) << 22n;
  const nowSnowflake = ((BigInt(Date.now()) - DISCORD_EPOCH) << 22n).toString();

  const all: DiscordMessage[] = [];
  let beforeId = nowSnowflake;

  for (let page = 0; page < config.discord.maxPages; page++) {
    if (page > 0) await sleep(config.discord.pageDelayMs);
    const batch = await fetchPage(channelId, "before", beforeId, 100);
    if (batch.length === 0) break;

    // Discard messages older than sinceDate and stop pagination
    const inRange = batch.filter((m) => BigInt(m.id) >= sinceSnowflake);
    all.push(...inRange);

    if (inRange.length < batch.length) break; // reached the start of the period
    if (batch.length < 100) break;

    beforeId = batch[batch.length - 1]!.id; // oldest message in batch
  }

  // Return in chronological order (oldest first)
  return all.reverse();
}
