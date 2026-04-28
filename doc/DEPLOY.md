# Deployment on Vercel

## 1. Link the project

```bash
npm i -g vercel
vercel link
```

## 2. Set environment variables

In the Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `DISCORD_PUBLIC_KEY` | From Discord Developer Portal |
| `DISCORD_APPLICATION_ID` | From Discord Developer Portal |
| `DISCORD_BOT_TOKEN` | From Discord Bot page |
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com/ |
| `REDIS_URL` | Auto-injected if using Vercel Storage (Redis Cloud) |

Then pull locally:
```bash
npx vercel env pull .env.local
```

## 3. Deploy

```bash
vercel --prod
```

## 4. Update Discord Interactions Endpoint

In Discord Developer Portal → General Information → Interactions Endpoint URL:
```
https://your-project.vercel.app/api/discord
```
