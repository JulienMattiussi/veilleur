import { NextResponse } from "next/server";

// Discord interaction types
export const PING = 1;
export const APPLICATION_COMMAND = 2;
export const MESSAGE_COMPONENT = 3;

// Discord interaction response types
export const PONG = 1;
export const CHANNEL_MESSAGE_WITH_SOURCE = 4;
export const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;
export const UPDATE_MESSAGE = 7;

export const EPHEMERAL = 64;

type InteractionOption = { name: string; value: unknown };

export type InteractionBody = {
  type: number;
  token?: string;
  application_id?: string;
  guild_id?: string;
  member?: { user: { id: string } };
  user?: { id: string };
  data?: {
    name?: string;
    options?: InteractionOption[];
    resolved?: {
      users?: Record<string, { username: string; global_name?: string | null }>;
      channels?: Record<string, { name?: string }>;
    };
    custom_id?: string;
    values?: string[];
  };
};

export function getUserId(body: InteractionBody): string {
  return body.member?.user.id ?? body.user?.id ?? "anonymous";
}

export function getStringOption(body: InteractionBody, name: string): string | undefined {
  const value = body.data?.options?.find((o) => o.name === name)?.value;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function ephemeralMessage(content: string): NextResponse {
  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: EPHEMERAL, content },
  });
}

export function updateMessage(content: string, components: unknown[]): NextResponse {
  return NextResponse.json({ type: UPDATE_MESSAGE, data: { content, components } });
}
