# Slack Signals Vision

## Goal

Build a Slack signal provider for Mastra agents that turns important Slack activity into durable notification signals an agent can reason about, summarize, and act on without requiring the user to manually monitor Slack.

The first product slice is intentionally simple:

- `subscribe` starts watching the Slack workspace for the current Mastra thread.
- A subscription means watching all reachable DMs, group DMs, public channels, and private channels that the configured token can access.
- `unsubscribe` stops watching that workspace for the current thread.
- New relevant Slack messages become Mastra notification records through the existing notification signal system.

## Product Direction

Slack Signals should become the Slack equivalent of the GitHub PR signal provider: a small package that plugs into an agent, manages subscriptions, polls an external system, compares high-water state, and emits notifications with enough metadata for agents and users to understand what changed.

Over time, this should support:

- Workspace-wide monitoring for DMs and channels.
- Configurable include/exclude channel policies.
- Keyword, mention, author, and channel filters.
- Thread-aware notifications for replies.
- Digest-style summaries for high-volume activity.
- Safe defaults that avoid historical backfills and excessive Slack API traffic.
- Token modes that make capabilities explicit: bot token, user token, and potentially Slack channel provider installation tokens.

## User Experience

The desired agent-facing experience should be similar to GitHub signals:

```ts
import { SlackSignalsProvider } from '@mastra/slack-signals';

const slackSignals = new SlackSignalsProvider({
  token: process.env.SLACK_BOT_TOKEN!,
});

const agent = new Agent({
  name: 'assistant',
  instructions: 'Help me track important workspace activity.',
  model,
  signals: [slackSignals],
});
```

Users should be able to ask naturally:

- "Subscribe to Slack."
- "Unsubscribe from Slack."
- "What Slack notifications are pending?"
- "Start watching Slack for messages about deploys."

The initial implementation only needs subscribe/unsubscribe and workspace-wide polling. More selective filters can be added once the polling, metadata, and notification lifecycle are stable.

## Non-Goals for the First Slice

- No Slack Desktop local database scraping.
- No Slack session-token scraping (`xoxc`/`xoxd`) in the default provider.
- No large historical archive import by default.
- No standalone Slack crawler CLI as a prerequisite.
- No message posting or Slack channel response behavior; this package is for signals, not chat-channel handling.
- No direct copy/paste from reference implementations, especially AGPL-licensed sources.

## Guiding Principles

1. **Use Mastra primitives first.** Extend `SignalProvider`, persist state in thread metadata, and emit through `sendNotificationSignal`.
2. **Prefer official Slack Web API for v0.** Keep token behavior predictable and document capability limits.
3. **Incremental polling only.** Track per-channel high-water timestamps and avoid broad historical backfills. Slack API `next_cursor` values are request-local pagination tokens, not durable sync state.
4. **Make access limits explicit.** Bot tokens only see conversations they are authorized for. User tokens may see more, especially DMs/search, but should be an explicit choice.
5. **Keep commits reviewable.** Each phase should land as one or more discrete commits. Before starting a new phase, the working tree should have no lingering uncommitted changes.
