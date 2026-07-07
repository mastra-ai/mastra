# @mastra/slack

Slack integration for Mastra agents. Handles app creation, OAuth, slash commands, and messaging.

The package ships two independent integrations:

- **`SlackProvider`** (channels) — a **bot identity**. Creates and installs a Slack app, receives events via webhooks (needs a public endpoint), and broadcasts agent output into Slack.
- **`SlackSignals`** (signals) — a **user identity**. Authorizes your Slack user account and polls subscribed conversations, waking agent threads when new messages arrive. Zero infrastructure: no webhooks, tunnels, or public endpoints. See [SlackSignals](#slacksignals-watch-slack-as-your-user).

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

## SlackSignals: watch Slack as your user

`SlackSignals` is a polling [signal provider](https://mastra.ai/docs/long-running-agents/signal-providers). Subscribe an agent thread to a Slack thread or channel and the agent gets woken with a notification signal when someone posts — the provider acts as **your Slack user**, so it can watch anything you can see (threads, channels, DMs) without inviting a bot.

```ts
import { Agent } from '@mastra/core/agent';
import { SlackSignals } from '@mastra/slack';

const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  model: 'openai/gpt-4.1',
  instructions: 'Watch Slack threads and follow up on replies.',
  signals: [new SlackSignals()],
});
```

The agent gets three tools: `slack_subscribe_thread`, `slack_unsubscribe_thread`, and `slack_list_subscriptions`. Subscriptions and last-seen cursors persist on thread metadata, so restarts never re-deliver old messages. Your own messages are skipped.

### Connecting your Slack account

`SlackSignals` authorizes a user account against a **pre-existing Slack app** configured as a PKCE public client (no client secret). Pass your app's `clientId` or set `MASTRA_SLACK_CLIENT_ID`:

```ts
const signals = new SlackSignals({ clientId: process.env.SLACK_CLIENT_ID });

await signals.auth.connect({
  onAuthUrl: url => console.log(`Open to authorize: ${url}`),
});
```

The connect flow opens a browser to Slack's authorize page and receives the redirect on a localhost loopback server. Credentials persist to `~/.mastra/slack-auth.json` (mode 0600) by default; pass `auth: { storage }` to supply your own `SlackCredentialStorage` (env vars, keychain, database).

Slack rotates the refresh token on every refresh — `SlackUserAuth` refreshes proactively before expiry and persists each rotation atomically. If the refresh token dies, `getToken()` throws `SlackAuthReconnectRequiredError` instead of surfacing raw `invalid_token` errors.

### Static token (headless / CI)

If you manage tokens yourself, skip OAuth entirely:

```ts
const signals = new SlackSignals({ token: process.env.SLACK_USER_TOKEN });
```

### Requested scopes

The default connect scopes are read-focused: `channels:history`, `groups:history`, `im:history`, `mpim:history`, `users:read`. Override with `auth: { scopes: [...] }`.

### SlackProvider vs SlackSignals

|           | `SlackProvider` (channels)                   | `SlackSignals` (signals)                         |
| --------- | -------------------------------------------- | ------------------------------------------------ |
| Identity  | Bot (app it creates/installs)                | Your Slack user account                          |
| Delivery  | Webhooks (needs public endpoint)             | Polling (default every 30s)                      |
| Direction | Two-way: receives events, broadcasts replies | One-way wake: notifies the agent of new messages |
| Setup     | App config tokens + tunnel/base URL          | PKCE connect flow or static token                |
