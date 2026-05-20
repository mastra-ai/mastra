# @mastra/slack

Slack integration for Mastra agents. Handles app creation, OAuth, slash commands, and messaging.

## Quick Start

```ts
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { SlackProvider } from '@mastra/slack';

const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  model: 'openai/gpt-4.1',
  instructions: 'You are a helpful assistant.',
});

const slack = new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  // For local dev, set SLACK_BASE_URL to your tunnel URL
  // In production, this is auto-derived from server config
  baseUrl: process.env.SLACK_BASE_URL,
});

const mastra = new Mastra({
  agents: { myAgent },
  channels: { slack },
});

// Or configure credentials later (e.g., from UI or vault)
// slack.configure({ refreshToken: 'xoxe-1-...' });

// Connect an agent to Slack (creates app, returns OAuth URL)
const { authorizationUrl } = await slack.connect('my-agent', {
  name: 'My Bot',
  description: 'An AI assistant',
  iconUrl: 'https://example.com/my-bot-icon.png',
  slashCommands: [
    { command: '/ask', prompt: 'Answer: {{text}}' },
    { command: '/help', prompt: 'List your capabilities.' },
  ],
});
```

## Setup

1. **Get App Configuration Tokens** from https://api.slack.com/apps (look for "Your App Configuration Tokens" section)

2. **Set up a tunnel** for local development:

   ```bash
   cloudflared tunnel --url http://localhost:4111
   ```

3. **Add to .env**:
   ```
   SLACK_APP_CONFIG_TOKEN=xoxe.xoxp-...
   SLACK_APP_CONFIG_REFRESH_TOKEN=xoxe-1-...
   SLACK_BASE_URL=https://abc123.trycloudflare.com
   ```

> ⚠️ **Token Rotation**: Slack config access tokens expire after 12 hours, but the refresh token does not expire (it's single-use — each rotation returns a new pair). Tokens auto-rotate and are persisted to storage, so the `.env` values are only used as the initial seed. If you lose your persisted storage (e.g., DB wipe), you'll need fresh tokens from the Slack dashboard.

## Storage & Persistence

`SlackProvider` automatically uses Mastra's storage if configured. Just add `storage` to your Mastra config:

```ts
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  agents: { myAgent },
  storage: new LibSQLStore({ url: 'file:./mastra.db' }),
  channels: {
    slack: new SlackProvider({
      refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN!,
    }),
  },
});
```

When Mastra has storage configured, `SlackProvider` automatically:

- Persists rotated config tokens (so you don't need fresh tokens after restart)
- Persists Slack app installations
- Detects config changes (e.g., agent renames) and updates manifests on startup

Without storage, data is lost on restart and apps are recreated.

## How It Works

1. Register a `SlackProvider` on your `Mastra` instance
2. Call `slack.connect(agentId)` to provision a Slack app and get an OAuth URL
3. Visit the OAuth URL to install the app to your Slack workspace
4. After installation, messages and slash commands route to your agent
5. Config access tokens auto-rotate (they expire every 12 hours) and are saved to storage

## Slash Commands

Commands use prompt templates with variable substitution:

```ts
await slack.connect('my-agent', {
  slashCommands: [
    {
      command: '/ask',
      description: 'Ask the AI a question',
      prompt: 'Answer this question: {{text}}',
    },
    {
      command: '/summarize',
      description: 'Summarize content',
      prompt: 'Summarize the following in 2-3 sentences: {{text}}',
    },
  ],
});
```

Available variables: `{{text}}`, `{{userId}}`, `{{channelId}}`, `{{teamId}}`

## App Icons

Each agent's Slack app can have its own icon:

```ts
await slack.connect('my-agent', {
  iconUrl: 'https://example.com/my-bot-avatar.png',
});
```

The image should be:

- Square (1:1 aspect ratio)
- At least 512x512 pixels
- PNG, JPG, or GIF format

The icon is uploaded automatically when the Slack app is created.

## Disconnecting

```ts
await slack.disconnect('my-agent');
```

This deletes the Slack app and removes the local installation record.
