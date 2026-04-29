# Discord Setup

## 1. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application**, name it "Veilleur"
3. Go to **Bot** (left menu)
   - Click **Reset Token**, copy it -> `DISCORD_BOT_TOKEN`
   - Under **Privileged Gateway Intents**, enable **Message Content Intent**
4. Go to **General Information**
   - Copy **Application ID** -> `DISCORD_APPLICATION_ID`
   - Copy **Public Key** -> `DISCORD_PUBLIC_KEY`

## 2. Invite the bot to your server

Under **OAuth2 -> URL Generator**, select:
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Read Messages/View Channels` + `Read Message History`

Copy the generated URL, open it in your browser, select your server, then click **Authorize**.

> Note: seeing Veilleur in your server's **Integrations** tab only means the slash command is registered - it does NOT mean the bot is a member. The bot must be explicitly invited via this OAuth2 URL before it appears in the member list.

## 2b. Grant access to restricted channels

If a channel has role-restricted access, explicitly grant the bot permission:

1. Right-click the channel -> **Edit channel**
2. Tab **Permissions** -> click **+** -> search **Veilleur**
3. Enable **View Channel** + **Read Message History** (Voir les anciens messages)
4. Save

> "Read Message History" is required - "View Channel" alone only lets the bot see new messages, not fetch past ones.

## 3. Configure your environment

```bash
cp .env.example .env.local
# Fill in DISCORD_PUBLIC_KEY, DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN
```

## 4. Install dependencies

```bash
make install
```

## 5. Register the slash command

```bash
make discord-register
```

The `/veille` command is registered globally (may take up to 1 hour to propagate).

## 6. Configure the Interactions Endpoint

Discord needs a public HTTPS URL to send interactions to.

**For local development**, use ngrok:

```bash
make start        # starts the dev server on port 7788
ngrok http 7788   # gives you a public URL like https://xxxx.ngrok-free.app
```

Then in Discord Developer Portal -> **General Information -> Interactions Endpoint URL**, set:

```
https://xxxx.ngrok-free.app/api/discord
```

Note: the `/api/discord` path is required - the bare domain will not work.

Click **Save Changes**. Discord sends an automatic PING - if the URL is accepted (green check), the setup is complete.

**For production**, set the Vercel deployment URL instead:

```
https://your-project.vercel.app/api/discord
```

## 7. Usage

```
/veille canal:#tech-watch période:7j
```

The bot responds with an ephemeral deferred message (only you see it), processes the channel in the background, then edits the message with the synthesized reading list.
