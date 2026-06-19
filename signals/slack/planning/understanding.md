# Slack Signals Understanding

## Existing Mastra Signal Model

Mastra already has the core pieces needed for a Slack signal provider:

- `SignalProvider<TId>` in `packages/core/src/signals/signal-provider.ts` manages lifecycle, subscriptions, polling, tools, and processor hooks.
- Agent construction with `signals: [...]` attaches providers, calls `connect()`, registers provider tools/processors, and starts polling.
- `SignalProvider.notify(notification, target)` wraps `agent.sendNotificationSignal()`.
- Notifications are persisted in the `notifications` storage domain and can be delivered, queued, deferred, summarized, discarded, seen, dismissed, or archived.
- The notification inbox tool already exposes user-facing notification CRUD operations.

The GitHub signal provider is the closest local pattern:

- Package lives in `signals/github`.
- Exports one provider class and related types from `src/index.ts`.
- Stores provider-specific state in thread metadata.
- Implements subscribe/unsubscribe/sync tools and signal input processors.
- Polls subscribed resources and emits notifications only when new external state crosses a notification threshold.
- Uses tests colocated at `signals/github/src/index.test.ts`.

## Slack Channel Provider vs Slack Signals Provider

The existing Slack channel provider in `channels/slack` is for interactive agent conversations in Slack:

- Creates/configures a Slack app via manifest APIs.
- Handles OAuth, webhook routes, slash commands, Slack adapters, tool approvals, and message streaming.
- Stores encrypted Slack installation tokens and activates `AgentChannels`.

Slack Signals is a different package:

- It watches Slack activity and emits notification signals.
- It should not require a Slack webhook route for the first polling-based slice.
- It should not own Slack chat response behavior.
- It may eventually reuse installation/token concepts from `channels/slack`, but v0 can accept a token directly.

## Subscription Semantics

The requested starting semantics are:

- A thread can subscribe to Slack once.
- Subscribed means "watch everything this token can see": DMs, group DMs, public channels, and private channels.
- Unsubscribe removes that thread's Slack workspace subscription.
- The provider should use thread metadata to persist subscription state and per-channel high-water timestamps.

A likely subscription ID shape:

```ts
type SlackSignalsSubscription = {
  workspaceId: string;
  workspaceName?: string;
  subscribedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
  channels: Record<string, SlackSignalsChannelState>;
};
```

A likely channel state shape:

```ts
type SlackSignalsChannelState = {
  id: string;
  name?: string;
  type: 'public_channel' | 'private_channel' | 'im' | 'mpim';
  latestTs?: string;
  latestMessageHash?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
};
```

## Slack API Realities

Slack message access depends heavily on token type and scopes.

Expected official Web API endpoints:

- `auth.test` to identify workspace/team and token identity.
- `conversations.list` with `types=public_channel,private_channel,im,mpim` to discover reachable conversations.
- `conversations.history` with `oldest` set from the stored per-channel high-water timestamp to fetch new messages.
- `conversations.replies` later, when thread reply monitoring is added.
- `users.info` / `users.list` later, for nicer notification attribution.

Important constraints:

- Bot tokens are limited to conversations the app/bot can access and may need to be invited to channels.
- DM and MPIM access requires the right Slack scopes and may be limited depending on app installation and token type.
- Slack timestamps are string values like `1718212345.000100` and should be compared carefully as Slack timestamps, not floating-point numbers.
- Slack `response_metadata.next_cursor` values are transient pagination tokens for one API query. They should be used while draining pages, but not stored as durable subscription state.
- Durable sync state should be the maximum processed Slack message timestamp per channel, such as `latestTs`.
- Search APIs generally require user-token capabilities and should not be part of the v0 polling path.
- Rate limits should be handled conservatively; polling must avoid overlapping cycles and should cap work per cycle.

## Notification Semantics

For v0, each new watched Slack message can become an individual notification when it passes filtering rules.

Suggested notification fields:

- `source`: `slack`
- `kind`: `slack-message`
- `sourceId`: `${teamId}:${channelId}:${messageTs}`
- `dedupeKey`: same as `sourceId`
- `coalesceKey`: `${teamId}:${channelId}`
- `summary`: human-readable channel/sender/message preview
- `payload`: structured Slack message metadata
- `attributes`: workspace, channel, sender, message ts, thread ts, channel type

V0 can keep filtering minimal and rely on dedupe keys plus high-water timestamps to prevent repeat notifications.

## Implementation Bias

The first build should be small and testable:

1. Define types, config, and a small Slack Web API sync client interface.
2. Implement provider tools/processors for subscribe/unsubscribe.
3. Implement polling against a mockable sync client.
4. Emit notification records for new messages.
5. Add unit tests that verify behavior without hitting Slack.

Do not start by building a local SQLite crawler or ingest archive. That can be a future backend once the provider contract is stable.
