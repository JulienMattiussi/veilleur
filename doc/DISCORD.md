# Discord Setup

## 1. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application**, name it "Veilleur"
3. Go to **Bot** → **Add Bot**
4. Copy the **Token** → `DISCORD_BOT_TOKEN`
5. Go to **General Information** → copy **Application ID** → `DISCORD_APPLICATION_ID`
6. Go to **General Information** → copy **Public Key** → `DISCORD_PUBLIC_KEY`

## 2. Bot Permissions

Under **OAuth2 → URL Generator**, select:
- Scope: `bot`, `applications.commands`
- Bot Permissions: `Read Messages/View Channels`, `Read Message History`

Use the generated URL to invite the bot to your server.

## 3. Configure the Interactions Endpoint

Under **General Information → Interactions Endpoint URL**, set:
```
https://your-domain.vercel.app/api/discord
```

Discord will send a PING - the app must respond with PONG to validate.

## 4. Register the Slash Command

Copy `.env.example` to `.env.local`, fill in `DISCORD_APPLICATION_ID` and `DISCORD_BOT_TOKEN`, then run:

```bash
make discord-register
```

This registers the `/veille` command globally (may take up to 1 hour to propagate).

## 5. Usage

```
/veille canal:#tech-watch période:7j
```

The bot will respond with a deferred message, then edit it with the synthesized reading list.
