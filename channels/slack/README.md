# @mastra/slack

Slack integration for Mastra agents. Handles app creation, OAuth, slash commands, and messaging.

## Quick Start

```ts
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { SlackChannel } from '@mastra/slack';

const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  model: 'openai/gpt-4.1',
  instructions: 'You are a helpful assistant.',
  channels: {
    slack: {
      name: 'My Bot',
      description: 'An AI assistant',
      iconUrl: 'https://example.com/my-bot-icon.png', // Optional: 512x512 PNG
      slashCommands: [
        { command: '/ask', prompt: 'Answer: {{text}}' },
        { command: '/help', prompt: 'List your capabilities.' },
      ],
    },
  },
});

const mastra = new Mastra({
  agents: { myAgent },
  channels: {
    slack: new SlackChannel({
      configToken: process.env.SLACK_CONFIG_TOKEN!,
      refreshToken: process.env.SLACK_CONFIG_REFRESH_TOKEN!,
      // For local dev, set SLACK_BASE_URL to your tunnel URL
      // In production, this is auto-derived from server config
      baseUrl: process.env.SLACK_BASE_URL,
    }),
  },
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
   SLACK_CONFIG_TOKEN=xoxe.xoxp-...
   SLACK_CONFIG_REFRESH_TOKEN=xoxe-1-...
   SLACK_BASE_URL=https://abc123.trycloudflare.com
   ```

> ⚠️ **Token Expiration**: Slack config tokens expire after 12 hours. Tokens auto-rotate and are persisted to storage. The `.env` tokens are only used as the initial seed. If your server is offline for >12 hours without persisted storage, you'll need fresh tokens from the Slack dashboard.

## Storage & Persistence

`SlackChannel` automatically uses Mastra's storage if configured. Just add `storage` to your Mastra config:

```ts
import { InMemoryStore } from '@mastra/core/storage';
// Or for persistence across restarts: import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  agents: { myAgent },
  storage: new InMemoryStore(),  // Or LibSQLStore, PostgresStore, etc.
  channels: {
    slack: new SlackChannel({
      configToken: process.env.SLACK_CONFIG_TOKEN,
      refreshToken: process.env.SLACK_CONFIG_REFRESH_TOKEN,
    }),
  },
});
```

When Mastra has storage configured, `SlackChannel` automatically:
- Persists rotated config tokens (so you don't need fresh tokens after restart)
- Persists Slack app installations
- Detects config changes and updates manifests

Without storage, data is lost on restart and apps are recreated.

## How It Works

1. On startup, `SlackChannel` auto-provisions a Slack app for each agent that has `channels.slack` config
2. The console logs an OAuth URL - visit it to install the app to your workspace
3. After installation, slash commands route to your agent and responses are sent back to Slack
4. Tokens auto-rotate every 12 hours and are saved to storage

## Slash Commands

Commands use prompt templates with variable substitution:

```ts
channels: {
  slack: {
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
  },
}
```

Available variables: `{{text}}`, `{{userId}}`, `{{channelId}}`, `{{teamId}}`

## App Icons

Each agent can have its own Slack app icon:

```ts
channels: {
  slack: {
    iconUrl: 'https://example.com/my-bot-avatar.png',
    // ...
  },
}
```

The image should be:
- Square (1:1 aspect ratio)
- At least 512x512 pixels
- PNG, JPG, or GIF format

The icon is uploaded automatically when the Slack app is created.

## Custom Storage

For advanced use cases, you can provide a custom `SlackStorage` implementation:

```ts
import { SlackStorage, SlackInstallation, PendingInstallation } from '@mastra/slack';

class MySlackStorage implements SlackStorage {
  async saveInstallation(installation: SlackInstallation): Promise<void> { ... }
  async getInstallation(agentId: string): Promise<SlackInstallation | null> { ... }
  async getInstallationByWebhookId(webhookId: string): Promise<SlackInstallation | null> { ... }
  // ... etc
}

new SlackChannel({
  storage: new MySlackStorage(),
  // ...
});
```

This bypasses Mastra's built-in storage and gives you full control.
