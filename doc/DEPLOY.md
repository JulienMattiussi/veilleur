# Deployment on Vercel

## 1. Link the project

```bash
npm i -g vercel
vercel link
```

## 2. Set environment variables

In the Vercel dashboard - Settings - Environment Variables, add:

| Variable                 | Value                               |
| ------------------------ | ----------------------------------- |
| `DISCORD_PUBLIC_KEY`     | From Discord Developer Portal       |
| `DISCORD_APPLICATION_ID` | From Discord Developer Portal       |
| `DISCORD_BOT_TOKEN`      | From Discord Bot page               |
| `ANTHROPIC_API_KEY`      | From https://console.anthropic.com/ |
| `REDIS_URL`              | Redis connection string (see below) |

Then pull locally:

```bash
npx vercel env pull .env.local
```

## 3. Set up Redis (required for production)

Without Redis, the select menu will always return "Le rapport a expiré" because serverless
function instances do not share memory.

In the Vercel dashboard - Storage - Create Database, choose a Redis provider (e.g. Redis Cloud).
Vercel will inject `REDIS_URL` automatically when you connect the database to your project.

Alternatively, connect an existing Redis database:

1. Storage - click the existing database
2. Tab Projects - Connect Project - select `veilleur`

> The bot falls back to an in-memory Map when `REDIS_URL` is absent - this works for local
> development (single process) but not for production (multiple serverless instances).

## 4. Deploy

```bash
vercel --prod
```

## 5. Update Discord Interactions Endpoint

In Discord Developer Portal - General Information - Interactions Endpoint URL:

```
https://your-project.vercel.app/api/discord
```
