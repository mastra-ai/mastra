# Slack Channel Example

This example shows how to connect a Mastra agent to Slack using the `@mastra/channel-slack` package.

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under **OAuth & Permissions**, add these scopes:
   - `chat:write` — Send messages
   - `app_mentions:read` — Receive mention events
   - `channels:history` — Read channel messages (for message events)
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (`xoxb-...`)
5. Under **Basic Information**, copy the **Signing Secret**

### 2. Configure environment

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
```

### 3. Install and run

```bash
pnpm i --ignore-workspace
pnpm dev
```

The server starts on `http://localhost:4111`. The Slack webhook endpoint is at:

```
POST http://localhost:4111/api/channels/slack/webhook
```

### 4. Configure Slack Event Subscriptions

1. In your Slack app settings, go to **Event Subscriptions**
2. Enable events and set the Request URL to your webhook endpoint
   - For local dev, use [ngrok](https://ngrok.com/) or similar: `ngrok http 4111`
   - Request URL: `https://<your-ngrok-url>/api/channels/slack/webhook`
3. Subscribe to bot events:
   - `message.channels` — Messages in public channels
   - `app_mention` — When your bot is mentioned
4. Save changes

### 5. Test

Invite the bot to a channel and send a message or mention it. The agent will respond in-thread.
