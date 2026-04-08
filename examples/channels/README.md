# Channels Example

This example shows how to connect a Mastra agent to Slack, Discord, and Telegram using the Chat SDK adapters.

## Setup

### 1. Configure environment

```bash
cp .env.example .env
```

Fill in the required API keys for your platforms:

```bash
# Required
OPENAI_API_KEY=sk-...

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Discord (optional)
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...

# Telegram (optional)
TELEGRAM_BOT_TOKEN=...
```

### 2. Install and run

```bash
pnpm i --ignore-workspace
pnpm dev
```

The server starts on `http://localhost:4111`. Webhook endpoints are available at:

```
POST /api/agents/example-agent/channels/slack/webhook
POST /api/agents/example-agent/channels/discord/webhook
POST /api/agents/example-agent/channels/telegram/webhook
```

For local development, use [ngrok](https://ngrok.com/) or similar to expose your local server:

```bash
ngrok http 4111
```

## Platform setup

### Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
1. Under **OAuth & Permissions**, add scopes: `chat:write`, `app_mentions:read`, `channels:history`, `groups:history`, `im:history`
1. Install the app to your workspace and copy the **Bot User OAuth Token**
1. Under **Basic Information**, copy the **Signing Secret**
1. Under **Event Subscriptions**, enable events and set the Request URL to your webhook endpoint
1. Subscribe to bot events: `message.channels`, `message.groups`, `message.im`, `app_mention`

### Discord

1. Create a Discord application at [discord.com/developers](https://discord.com/developers/applications)
1. Under **Bot**, enable the bot and copy the token
1. Enable **Message Content Intent** in Bot settings
1. Under **General Information**, copy the **Public Key**
1. Set the **Interactions Endpoint URL** to your webhook endpoint (or use Gateway mode)

### Telegram

1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token
1. Set the webhook URL:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/agents/example-agent/channels/telegram/webhook
   ```

## Test

Send a message or mention the bot in any configured platform. The agent will respond in the thread.
