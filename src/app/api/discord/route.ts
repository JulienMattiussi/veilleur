import { NextRequest, NextResponse, after } from "next/server";
import { verifyDiscordSignature } from "@/lib/discord";
import {
  type InteractionBody,
  PING,
  PONG,
  APPLICATION_COMMAND,
  MESSAGE_COMPONENT,
  CHANNEL_MESSAGE_WITH_SOURCE,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  EPHEMERAL,
} from "@/lib/interactions";
import { processVeilleCommand, handleVeilleComponent } from "@/commands/veille";
import { processStatsCommand, handleStatsComponent } from "@/commands/stats";

// Slash commands: answered with a deferred ephemeral response, processed in the background.
const COMMANDS: Record<string, (body: InteractionBody) => Promise<void>> = {
  veille: processVeilleCommand,
  stats: processStatsCommand,
};

// Message components (select menus, buttons), routed by custom_id prefix.
const COMPONENT_HANDLERS: Record<string, (body: InteractionBody) => Promise<NextResponse | null>> =
  {
    veille_: handleVeilleComponent,
    stats_: handleStatsComponent,
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

  const command = body.type === APPLICATION_COMMAND ? COMMANDS[body.data?.name ?? ""] : undefined;
  if (command) {
    after(command(body));
    return NextResponse.json({
      type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: EPHEMERAL },
    });
  }

  if (body.type === MESSAGE_COMPONENT) {
    const customId = body.data?.custom_id ?? "";
    const prefix = Object.keys(COMPONENT_HANDLERS).find((p) => customId.startsWith(p));
    const response = prefix ? await COMPONENT_HANDLERS[prefix]?.(body) : null;
    if (response) return response;
  }

  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Commande inconnue." },
  });
}
