import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature } from "@/lib/discord";

// Discord interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;

const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";
  if (!verifyDiscordSignature(rawBody, signature, timestamp, publicKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { type: number; data?: { name: string; options?: unknown[] } };

  if (body.type === PING) {
    return NextResponse.json({ type: PONG });
  }

  if (body.type === APPLICATION_COMMAND && body.data?.name === "veille") {
    // Acknowledge immediately - processing happens in a follow-up (deferred response)
    // The actual work is done in a background job that calls the Discord webhook
    void processVeilleCommand(body);

    return NextResponse.json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
  }

  return NextResponse.json(
    { type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Commande inconnue." } },
  );
}

async function processVeilleCommand(body: {
  data?: { options?: Array<{ name: string; value: unknown }> };
  token?: string;
  application_id?: string;
}): Promise<void> {
  // TODO: parse options (canal, période), fetch messages, extract links, summarize, post follow-up
  void body;
}
