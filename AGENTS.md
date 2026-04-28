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
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() })
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
3. For `/veille`: respond with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5) immediately
4. Process in the background, then POST to Discord follow-up webhook

### Reading channel messages

- Use `fetchAllMessagesInPeriod()` from `src/lib/discord.ts`
- Discord REST API: `GET /channels/{id}/messages?after={snowflake}&limit=100`
- Paginate until fewer than 100 messages are returned
- Snowflake conversion: `(timestamp_ms - 1420070400000) << 22`

### Registering commands

Run once with `make discord-register` (requires env vars).

---

## Link extraction rules (`src/lib/link-extractor.ts`)

- Extract all `https?://` URLs from message content
- Strip trailing punctuation (`. , ; : ! ? ) ]`)
- Deduplicate across messages (first occurrence wins)
- Ignore: `discord.com`, `discord.gg`, `tenor.com`, `giphy.com`, CDN domains
- All extraction logic must be **pure functions**, no side effects

---

## AI summarization (`src/lib/summarizer.ts`)

- Use `claude-sonnet-4-6` model
- Batch all URLs in a single prompt (not one request per URL)
- Response format: `[{"url":"...","title":"...","summary":"...","tags":[...]}]`
- Gracefully handle JSON parse failures (fall back to URL as title)
- Never call Anthropic SDK directly in route handlers - always go through `summarizeLinks()`

---

## Cache (`src/lib/cache.ts`)

- All Redis reads/writes through `src/lib/cache.ts` - never call `ioredis` directly in routes
- In-memory `Map` fallback on `global._localStore` when `REDIS_URL` is absent (local dev, survives HMR)
- Cache key: `report:{channelId}:{period}` - TTL 6 hours

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_PUBLIC_KEY` | yes | Ed25519 webhook verification |
| `DISCORD_APPLICATION_ID` | yes | Registering slash commands |
| `DISCORD_BOT_TOKEN` | yes | Reading channel messages via REST |
| `ANTHROPIC_API_KEY` | yes | Claude AI summarization |
| `REDIS_URL` | no | Redis cache (in-memory fallback if absent) |

---

## Makefile commands

| Command | Description |
|---|---|
| `make install` | Install npm deps + Playwright |
| `make dev` | Start dev server on port 7788 |
| `make start` / `make stop` | Background server |
| `make check` | Full CI gate (format + lint + types + tests) |
| `make discord-register` | Register `/veille` slash command (run once) |
| `make clean` | Remove build artefacts |
