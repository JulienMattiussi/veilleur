# Veilleur - Conventions & Development Rules

## Project overview

Veilleur is a Discord bot for tech watch (veille informatique). It reads messages from a Discord
channel over a given period, extracts shared links, and uses Claude AI to produce a categorized
reading list.

**Stack**: Next.js 16 · TypeScript strict · Anthropic Claude SDK · Discord REST API · Redis Cloud

**Port**: 7788 (dev)

---

## Mandatory checklist before marking a task done

Run `make check` (format-check + lint + typecheck + test-unit). All must pass.

---

## Testing

### Unit tests (`tests/unit/`)

- Use **Vitest** with `globals: true`
- No network calls - mock at module boundaries
- All parsing/extraction functions must be **pure and independently testable**
- Mock `fetch` globally in `beforeEach`: `vi.stubGlobal("fetch", vi.fn())`

### Component tests (`tests/component/`)

- Use **Vitest + @testing-library/react**
- `"use client"` components only
- jsdom quirks - stub at module level:
  ```ts
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() });
  ```

### E2E tests (`tests/e2e/`)

- Use **Playwright** (chromium only)
- `baseURL`: `http://localhost:7788`

---

## Writing rules

- **Never use em dashes** (the `&mdash;` / Unicode U+2014 character) anywhere - use regular hyphens (`-`) instead

## TypeScript & code style

- **Strict TypeScript** - no implicit `any`, `noUncheckedIndexedAccess` enabled
- **Module resolution**: bundler, ESM modules
- **Path alias**: `@/*` → `./src/*`
- **Code & comments in English**, UI copy in French
- **No hardcoded colors** - always use `var(--token)` from `src/styles/theme.css`
- **No Tailwind** - all styling via inline styles + CSS custom properties
- **No speculative abstractions** - don't add helpers not required by the current task

---

## Discord integration

### Signature verification

All Discord webhook calls must be verified with `verifyDiscordSignature()` from `src/lib/discord.ts`
(Ed25519 via tweetnacl). Return 401 immediately on failure.

### Interaction response pattern

1. Verify signature
2. Respond to PING with PONG (type 1)
3. For `APPLICATION_COMMAND` `/veille`: respond with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5) + `flags: 64` (ephemeral) immediately, then process in the background with `after()` from `next/server`
4. For `MESSAGE_COMPONENT` (`veille_select:*`): respond synchronously with `CHANNEL_MESSAGE_WITH_SOURCE` (type 4) - no deferred needed
5. All responses are ephemeral (flag 64) - only the invoking user sees the result

### Reading channel messages

- Use `fetchAllMessagesInPeriod()` from `src/lib/discord.ts`
- Discord REST API: `GET /channels/{id}/messages?before={snowflake}&limit=100`
- Paginate **backwards from now** (most recent first) - stops when a batch contains messages older than the period
- Snowflake conversion: `(timestamp_ms - 1420070400000) << 22`

### Registering commands

Run once with `make discord-register` (requires env vars).

---

## Link extraction rules (`src/lib/link-extractor.ts`)

- Extract all `https?://` URLs from message content
- Strip trailing punctuation (`. , ; : ! ? ) ]`)
- Deduplicate across messages (first occurrence wins)
- Ignore: `discord.com`, `discord.gg`, `tenor.com`, `giphy.com`, `klipy.com`, CDN domains
- All extraction logic must be **pure functions**, no side effects

---

## AI summarization (`src/lib/summarizer.ts`)

- Use `claude-sonnet-4-6` model
- Batch all URLs in a single prompt (not one request per URL)
- Response format: `[{"url":"...","title":"...","summary":"...","tags":[...]}]`
- Strip markdown code fences before parsing (Claude sometimes wraps JSON in ` ```json ``` `)
- Gracefully handle JSON parse failures (fall back to URL as title)
- **Stub mode**: when `ANTHROPIC_API_KEY` is absent, returns links with `title=url`, empty summary and tags - bot is fully functional without the key
- Never call Anthropic SDK directly in route handlers - always go through `summarizeLinks()`

---

## Cache (`src/lib/cache.ts`)

- All Redis reads/writes through `src/lib/cache.ts` - never call `ioredis` directly in routes
- In-memory `Map` fallback on `global._localStore` when `REDIS_URL` is absent (local dev only - survives HMR but not across serverless instances)
- **Redis is required in production**: without it the select menu always returns "rapport expiré" because each serverless invocation gets a fresh in-memory store
- Cache key: `report:{channelId}:{period}` - TTL 6 hours

---

## Environment variables

| Variable                 | Required | Purpose                                       |
| ------------------------ | -------- | --------------------------------------------- |
| `DISCORD_PUBLIC_KEY`     | yes      | Ed25519 webhook verification                  |
| `DISCORD_APPLICATION_ID` | yes      | Registering slash commands                    |
| `DISCORD_BOT_TOKEN`      | yes      | Reading channel messages via REST             |
| `ANTHROPIC_API_KEY`      | no       | Claude AI summarization (stub mode if absent) |
| `REDIS_URL`              | prod     | Redis cache (in-memory fallback in dev only)  |

---

## Makefile commands

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `make install`             | Install npm deps + Playwright                |
| `make dev`                 | Start dev server on port 7788                |
| `make start` / `make stop` | Background server                            |
| `make check`               | Full CI gate (format + lint + types + tests) |
| `make discord-register`    | Register `/veille` slash command (run once)  |
| `make clean`               | Remove build artefacts                       |
