# @mastra/slack-signals

Slack Signals lets a Mastra agent watch Slack activity and surface new messages through Mastra's notification signal system.

## What it does

- Adds a `SlackSignalsProvider` for Mastra agents.
- Lets a thread subscribe or unsubscribe from Slack activity.
- Watches all reachable public channels, private channels, DMs, and group DMs by default.
- Polls Slack with the official Web API.
- Stores per-channel `latestTs` high-water timestamps in thread metadata.
- Emits durable Mastra notifications for new watched messages.
- Filters notification emission without stopping conversation discovery or high-water advancement.

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
  token: process.env.SLACK_BOT_TOKEN!,
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

## Configuration

```ts
const slackSignals = new SlackSignalsProvider({
  token: process.env.SLACK_BOT_TOKEN!,
  pollIntervalMs: 60_000,
  maxMessagesPerChannel: 100,
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

`include` controls which Slack conversation types are requested from `conversations.list`:

| Option | Slack type | Default |
| --- | --- | --- |
| `publicChannels` | `public_channel` | `true` |
| `privateChannels` | `private_channel` | `true` |
| `dms` | `im` | `true` |
| `groupDms` | `mpim` | `true` |

The token still limits what Slack returns. Bot tokens only see conversations the bot can access.

### `filters`

Filters only control notification emission. The provider still syncs discovered conversations and advances channel `latestTs` for filtered messages so the next poll does not repeatedly inspect the same old messages.

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

- `auth.test`
- `conversations.list`
- `conversations.history`

Typical bot-token scopes:

| Conversation type | Discovery scope | History scope |
| --- | --- | --- |
| Public channels | `channels:read` | `channels:history` |
| Private channels | `groups:read` | `groups:history` |
| DMs | `im:read` | `im:history` |
| Group DMs | `mpim:read` | `mpim:history` |

A bot token must also be able to access the conversation. For example, private channels usually require the bot to be invited. User tokens can expose different Slack access, but they should only be used when the workspace and user have explicitly approved that access.

## Sync behavior

The provider keeps durable sync state in Mastra thread metadata under `mastra.slackSignals.subscription`.

For each channel, the provider stores:

- `latestTs`: latest Slack timestamp safely processed for that channel.
- `lastSyncAt`
- `lastSyncStatus`
- `lastSyncError` when a sync fails.

Polling flow:

1. Load the thread subscription.
2. Discover reachable conversations with `conversations.list`.
3. For each conversation, call `conversations.history` with `oldest: latestTs` and `inclusive: false`.
4. Emit notifications for messages that pass filters.
5. Advance `latestTs` after successful processing.
6. Persist sync status back to thread metadata.

Slack `response_metadata.next_cursor` values are only used inside the current API request loop. They are never stored as durable sync state.

On first discovery of a channel with no `latestTs`, the provider records the latest observed timestamp as a baseline and does not emit historical notifications. This avoids flooding the notification inbox on first subscribe.

## Testing and local development

Use mock sync clients for deterministic unit tests:

```ts
const syncClient = {
  getWorkspace: async () => ({ teamId: 'T123', teamName: 'Example' }),
  listConversations: async () => ({
    conversations: [{ id: 'C123', name: 'alerts', type: 'public_channel' as const }],
  }),
  listMessages: async () => ({
    latestTs: '1710000002.000000',
    messages: [
      {
        channelId: 'C123',
        channelName: 'alerts',
        channelType: 'public_channel' as const,
        ts: '1710000002.000000',
        user: 'U123',
        text: 'New alert',
      },
    ],
  }),
};

const slackSignals = new SlackSignalsProvider({
  token: 'xoxb-test',
  syncClient,
});
```

The HTTP client also accepts a custom `baseUrl`, `fetch`, `maxRetries`, and `sleep` through `SlackWebApiSyncClient` for emulator or test environments.

```ts
import { SlackSignalsProvider, SlackWebApiSyncClient } from '@mastra/slack-signals';

const syncClient = new SlackWebApiSyncClient({
  token: 'xoxb-test',
  baseUrl: 'http://localhost:4003/api/',
});

const slackSignals = new SlackSignalsProvider({
  token: 'xoxb-test',
  syncClient,
});
```

## Limitations

- Polling-based only; no Slack Events API consumer in this package yet.
- No `conversations.replies` polling for thread replies beyond messages returned by `conversations.history`.
- No Slack archive import.
- No Slack Desktop database access.
- No `xoxc`/`xoxd` browser-session token scraping.
- No local Slack mirror database.
- No Slack write behavior.

## Verification

From the repository root:

```bash
pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot
pnpm --filter ./signals/slack build
```
