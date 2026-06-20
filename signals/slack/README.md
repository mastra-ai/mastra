# @mastra/slack-signals

Slack Signals lets a Mastra agent watch Slack activity and surface new messages through Mastra's notification signal system.

## What it does

- Adds a `SlackSignalsProvider` for Mastra agents.
- Lets a thread subscribe or unsubscribe from Slack activity.
- Watches all reachable public channels, private channels, DMs, and group DMs by default.
- Uses the Slack RTM API (WebSocket) for real-time message delivery — no polling.
- Emits durable Mastra notifications for new messages.
- Filters by channel, keyword, and bot/user identity.

This package is signals-only. It does not send Slack replies, import Slack archives, scrape Slack Desktop data, or use browser session tokens.

## Installation

```bash
pnpm add @mastra/slack-signals
```

## Basic usage

```ts
import { Agent } from '@mastra/core/agent';
import { SlackSignalsProvider } from '@mastra/slack-signals';

const slackSignals = new SlackSignalsProvider({
  token: process.env.SLACK_USER_TOKEN!,
});

export const agent = new Agent({
  name: 'slack-aware-agent',
  instructions: 'Monitor Slack notifications and help the user triage them.',
  model,
  signals: [slackSignals],
});
```

When the provider is attached to an agent, it adds:

- `slack_subscribe` tool: subscribe the current thread to Slack activity.
- `slack_unsubscribe` tool: unsubscribe the current thread.
- `SlackSignalsProvider.signals.subscribe()`: typed reactive subscribe signal.
- `SlackSignalsProvider.signals.unsubscribe()`: typed reactive unsubscribe signal.

A subscribed thread receives Slack messages as notification records with:

- `source`: `slack`
- `kind`: `slack-message`
- `sourceId` / `dedupeKey`: `${teamId}:${channelId}:${messageTs}`
- `coalesceKey`: `${teamId}:${channelId}`
- payload fields for team, channel, message timestamp, user, bot, text, thread timestamp, and permalink when Slack returns it.

## How it works

The provider opens a single persistent WebSocket connection to Slack's RTM API on `connect()`. Messages arrive in real-time — no polling, no baseline pass, no per-channel HTTP requests. Each incoming RTM `message` event is mapped to a notification and dispatched to all subscribed threads.

### RTM connection lifecycle

1. `connect()` calls `rtm.connect` to get a WebSocket URL, opens the connection, and registers a message handler.
2. The WebSocket receives `message` events for all channels the token can access.
3. Messages with subtypes like `message_changed` or `message_deleted` are skipped. `bot_message` events are allowed.
4. Each message is checked against filters, then dispatched to subscribed threads via `notify()`.
5. Auto-reconnect with exponential backoff handles socket disconnects.
6. Ping/pong keepalive detects dead connections and triggers reconnect.

### Subscription management

Subscriptions are stored in Mastra thread metadata under `mastra.slackSignals.subscription`. On `connect()`, the provider scans thread storage for threads with Slack metadata and restores them to the in-memory subscribed set, so messages flow immediately after restart.

## Configuration

```ts
const slackSignals = new SlackSignalsProvider({
  token: process.env.SLACK_USER_TOKEN!,
  include: {
    publicChannels: true,
    privateChannels: true,
    dms: true,
    groupDms: true,
  },
  filters: {
    includeChannelNames: ['alerts', 'support'],
    excludeChannelIds: ['C1234567890'],
    keywords: ['urgent', 'incident'],
    ignoreBotMessages: true,
    ignoredBotIds: ['B1234567890'],
    ignoredUserIds: ['U1234567890'],
    maxPreviewLength: 240,
    priority: {
      channels: 'low',
      dms: 'high',
      groupDms: 'high',
      mentions: 'urgent',
    },
  },
});
```

### `include`

`include` controls which Slack conversation types the subscription tracks:

| Option | Slack type | Default |
| --- | --- | --- |
| `publicChannels` | `public_channel` | `true` |
| `privateChannels` | `private_channel` | `true` |
| `dms` | `im` | `true` |
| `groupDms` | `mpim` | `true` |

### `filters`

Filters control which messages produce notifications. Messages that don't match are silently dropped.

Supported filters:

- `includeChannelIds`
- `excludeChannelIds`
- `includeChannelNames`
- `excludeChannelNames`
- `keywords`
- `ignoreBotMessages`
- `ignoredBotIds`
- `ignoredUserIds`
- `maxPreviewLength`
- `priority.channels`
- `priority.dms`
- `priority.groupDms`
- `priority.mentions`

Default priorities are:

| Message type | Priority |
| --- | --- |
| Public/private channel message | `low` |
| DM | `high` |
| Group DM | `high` |
| Mention of the authenticated user or bot | `high` |

Mentions are detected from Slack mention syntax such as `<@U123>` or `<@B123>` when `auth.test` returns the authenticated user or bot ID.

## Token scopes

The provider uses these Slack Web API methods:

- `auth.test` (subscribe flow — verifies token and gets workspace info)
- `rtm.connect` (opens WebSocket)

A **user token (`xoxp-`)** is recommended — it acts as your Slack identity, giving access to all channels and DMs you're a member of. Bot tokens (`xoxb-`) only see channels they've been explicitly invited to, so they can't watch "all DMs and channels" without admin intervention. Only use a user token in workspaces where you've approved that access.

Required scopes (User Token Scopes in the Slack app config):

| Scope | Used for |
| --- | --- |
| `rtm:streaming` | RTM WebSocket connection (`rtm.connect`) — **required** |
| `channels:read` | Public channel discovery |
| `channels:history` | Public channel message history |
| `groups:read` | Private channel discovery |
| `groups:history` | Private channel message history |
| `im:read` | DM discovery |
| `im:history` | DM message history |
| `mpim:read` | Group DM discovery |
| `mpim:history` | Group DM message history |
| `search:read` | Search (future use) |

## Testing and local development

Use mock RTM clients and sync clients for deterministic unit tests:

```ts
const syncClient = {
  getWorkspace: async () => ({ teamId: 'T123', teamName: 'Example' }),
  listConversations: async () => ({ conversations: [] }),
  listMessages: async () => ({ messages: [] }),
};

const slackSignals = new SlackSignalsProvider({
  token: 'xoxp-test',
  syncClient,
  rtmClient: mockRtmClient,
});
```

The HTTP sync client also accepts a custom `baseUrl`, `fetch`, `maxRetries`, and `sleep` through `SlackWebApiSyncClient` for emulator or test environments.

```ts
import { SlackSignalsProvider, SlackWebApiSyncClient } from '@mastra/slack-signals';

const syncClient = new SlackWebApiSyncClient({
  token: 'xoxp-test',
  baseUrl: 'http://localhost:4003/api/',
});

const slackSignals = new SlackSignalsProvider({
  token: 'xoxp-test',
  syncClient,
});
```

## Limitations

- RTM is a legacy Slack API. Still fully functional, but Slack recommends Socket Mode for new integrations. Migration path is documented for the future.
- No historical backfill — messages are only received from the moment the RTM connection opens. Messages sent while the provider is disconnected are not retrieved.
- No `conversations.replies` — thread replies beyond the initial message are not individually tracked.
- No Slack archive import.
- No Slack Desktop database access.
- RTM message rate limit: 1 message per second sustained, 16KB per message.
