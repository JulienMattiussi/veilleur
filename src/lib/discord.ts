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
    return nacl.sign.detached.verify(new Uint8Array(message), new Uint8Array(sig), new Uint8Array(key));
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

export async function fetchChannelMessages(
  channelId: string,
  after: string,
  limit = 100,
): Promise<DiscordMessage[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const url = `${DISCORD_API}/channels/${channelId}/messages?after=${after}&limit=${limit}`;

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
): Promise<void> {
  const url = `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}


export async function fetchAllMessagesInPeriod(
  channelId: string,
  sinceDate: Date,
): Promise<DiscordMessage[]> {
  // Discord snowflake: shift timestamp left by 22 bits and add Discord epoch (2015-01-01)
  const DISCORD_EPOCH = 1420070400000n;
  const snowflake = (BigInt(sinceDate.getTime()) - DISCORD_EPOCH) << 22n;
  const afterId = snowflake.toString();

  const all: DiscordMessage[] = [];
  let lastId = afterId;

  for (let page = 0; page < config.discord.maxPages; page++) {
    if (page > 0) await sleep(config.discord.pageDelayMs);
    const batch = await fetchChannelMessages(channelId, lastId, 100);
    if (batch.length === 0) break;
    all.push(...batch);
    lastId = batch[batch.length - 1]!.id;
    if (batch.length < 100) break;
  }

  return all;
}
