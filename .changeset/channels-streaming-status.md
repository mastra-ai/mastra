---
'@mastra/core': minor
'@mastra/slack': patch
---

Stream agent text to channels with adaptive typing status.

- Adds optional `streaming` to `ChannelAdapterConfig` (per-adapter, default `false`). Enable it on adapters that support native streaming (e.g. Slack) and leave it off on adapters that fall back to post+edit (e.g. Discord). When enabled, the agent's text deltas are pushed into the platform message progressively via the Chat SDK's `StreamingPlan`. On `SlackProvider`, pass `streaming: true` directly (along with other per-adapter overrides like `cards`, `formatToolCall`, `formatError`) instead of nesting under `adapterConfig`. The `adapterConfig` field still works as a deprecated fallback.
- Typing indicator now reflects what the agent is doing: `Thinking…` while reasoning, `Typing…` while generating text, and `Using {toolName}…` while a tool is running. Status updates are coalesced so the platform API isn't called on every delta.
- The Mastra logger is now propagated into `AgentChannels` on register so channel-level logs flow through the configured logger.
- Slack: `assistant:write` is now part of `DEFAULT_BOT_SCOPES`, so newly generated app manifests support the AI Assistant surface and thread context in DMs.
