---
'@mastra/core': minor
'@mastra/slack': patch
---

Stream agent text to channels with adaptive typing status.

- Adds optional `streaming` to `ChannelAdapterConfig` (per-adapter, default `false`). When enabled, the agent's text deltas are pushed into the platform message progressively via the Chat SDK's `StreamingPlan`. Adapters that fall back to post+edit (e.g. Discord) should leave it off.
- `SlackProvider` defaults `streaming: true` (Slack supports native message streaming). Opt out with `new SlackProvider({ streaming: false })`. Other per-adapter overrides (`cards`, `formatToolCall`, `formatError`) can also be passed directly at the top level of `SlackProvider` config instead of nesting under `adapterConfig`. The `adapterConfig` field still works as a deprecated fallback.
- Typing indicator now reflects what the agent is doing: `Thinking…` while reasoning, `Typing…` while generating text, and `Using {toolName}…` while a tool is running. Status updates are coalesced so the platform API isn't called on every delta.
- The Mastra logger is now propagated into `AgentChannels` on register so channel-level logs flow through the configured logger.
- Slack: `assistant:write` is now part of `DEFAULT_BOT_SCOPES` and the generated manifest declares the matching `assistant_view` feature, so newly generated app manifests support the AI Assistant surface and thread context in DMs.
