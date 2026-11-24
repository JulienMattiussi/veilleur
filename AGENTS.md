# Veilleur - Conventions & Development Rules

## Project overview

Veilleur is a Discord bot for tech watch (veille informatique). It reads messages from a Discord
channel over a given period, extracts shared links, and uses Claude AI to produce a categorized
reading list (`/veille`). It also computes AI-free statistics on a channel: matching messages by
author and/or term, top authors, top shared domains, with links to the messages (`/stats`).

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

## Code layout

- `src/app/api/discord/route.ts` - thin router: signature check, PING, dispatch by command name
  and by `custom_id` prefix (`veille_`, `stats_`)
- `src/commands/<name>.ts` - one module per slash command: background processing + component handlers
- `src/lib/interactions.ts` - Discord interaction types, constants and response helpers
- `src/lib/pagination.ts` - page splitting by rendered length + Previous/Next buttons, shared by
  both reports
- Pure logic stays in `src/lib/` (`stats.ts`, `stats-formatter.ts`, `date-range.ts`, `formatter.ts`...)

---

## Discord integration

### Signature verification

All Discord webhook calls must be verified with `verifyDiscordSignature()` from `src/lib/discord.ts`
(Ed25519 via tweetnacl). Return 401 immediately on failure.

### Interaction response pattern

1. Verify signature
2. Respond to PING with PONG (type 1)
3. For `APPLICATION_COMMAND` `/veille`: respond with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5) + `flags: 64` (ephemeral) immediately, then process in the background with `after()` from `next/server`
4. For `MESSAGE_COMPONENT` (`veille_select:*`): add selected indices to the user's basket, respond with `UPDATE_MESSAGE` (type 7) - updates the report message in place
5. For `MESSAGE_COMPONENT` (`veille_page:*`): navigate to the requested page, respond with `UPDATE_MESSAGE` (type 7) - basket count is preserved in the Valider button
6. For `MESSAGE_COMPONENT` (`veille_validate:*`): read basket, post curated list as `CHANNEL_MESSAGE_WITH_SOURCE` (type 4), clear basket
7. For `APPLICATION_COMMAND` `/stats`: same deferred ephemeral pattern, processed with `after()`
8. For `MESSAGE_COMPONENT` (`stats_page:<reportId>:<page>`): render the requested page of the cached
   stats report, respond with `UPDATE_MESSAGE` (type 7)
9. All responses are ephemeral (flag 64) - only the invoking user sees the result
10. `editFollowUp()` sends `allowed_mentions: { parse: [] }`: reports quote user content and must never ping

User ID is extracted from `body.member.user.id` (guild) or `body.user.id` (DM) to scope baskets per user.

### Reading channel messages

- Use `fetchAllMessagesInPeriod()` from `src/lib/discord.ts`
- Discord REST API: `GET /channels/{id}/messages?before={snowflake}&limit=100`
- Paginate **backwards from the end of the period** (`until`, defaults to now) - stops when a batch
  contains messages older than the period
- Capped at `maxPages` (100 messages each): `config.discord.maxPages` for `/veille`,
  `config.stats.maxPages` for `/stats`; returns `{ messages, truncated }`
- Snowflake conversion: `(timestamp_ms - 1420070400000) << 22`

### Registering commands

Run `make discord-register` (requires env vars) after adding a command or changing its options.
It overwrites the whole command set (`PUT`), so every command must be listed in
`scripts/register-discord-command.ts`.

---

## Link extraction rules (`src/lib/link-extractor.ts`)

- Extract all `https?://` URLs from message content
- Strip trailing punctuation (`. , ; : ! ? ) ]`)
- Deduplicate across messages (first occurrence wins)
- Ignore: `discord.com`, `discord.gg`, `tenor.com`, `giphy.com`, `klipy.com`, CDN domains
- All extraction logic must be **pure functions**, no side effects

---

## Stats (`src/lib/stats.ts`, `src/lib/date-range.ts`, `src/lib/stats-formatter.ts`)

- **No AI**: counting and filtering only, all pure functions
- Options: `canal` (required), `début`, `fin`, `auteur` (USER), `terme`
- Dates: `JJ/MM/AAAA` or `AAAA-MM-JJ`, interpreted in `config.stats.timeZone`; end date included,
  defaults to today; start defaults to `config.stats.defaultDays` before the end
- Term: case-insensitive substring; bot messages are ignored
- Links counted once (first sharer), via `extractLinks()`
- Page 0 is the summary, next pages list matching messages (most recent first) with jump links
  `https://discord.com/channels/{guild}/{channel}/{message}`; user content is markdown-escaped

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
- Report key: `report:{channelId}:{period}` - TTL 6 hours
- Basket key: `basket:{channelId}:{period}:{userId}` - TTL 6 hours (same as report)
- Stats key: `stats:{reportId}` (random id, carried in the page buttons) - TTL 6 hours

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
| `make discord-register`    | Register `/veille` and `/stats` commands     |
| `make clean`               | Remove build artefacts                       |
