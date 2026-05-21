---
'@mastra/core': minor
'@mastra/slack': patch
---

Improved agent channels UX:

- **Streaming text** — opt-in per-adapter `streaming` flag (`boolean | { updateIntervalMs?: number }`) that pushes the agent's text deltas into the platform message progressively via the Chat SDK. Slack supports this natively; `SlackProvider` defaults `streaming: true`.
- **Adaptive typing indicator** — the platform's typing status now reflects what the agent is doing (`Typing…` while generating text, `Calling {toolName}…` while a tool runs), coalesced so the platform API isn't called on every delta.
- **`toolDisplay` modes** — new `ChannelAdapterConfig.toolDisplay` controls how tool calls render:
  - `'cards'` (default) — per-tool running/result cards (unchanged behavior).
  - `'timeline'` — every tool gets its own task row in a streaming widget with status icons and args.
  - `'grouped'` — all tools in the run collapse into a single streaming widget; args fold inline into the title and successful results are suppressed for an at-a-glance summary (errors keep their full text).
  - `'hidden'` — tools run silently; only the typing indicator shows work.

  `'timeline'` and `'grouped'` require `streaming: true` and fall back to `'cards'` with a one-time warn if not enabled. Approve/deny prompts always render as a separate card regardless of mode, since inline task entries can't carry interactive buttons.
- **Parallel same-tool approval** — fixed a bug where two parallel calls to the same tool with `requireApproval: true` clobbered each other's pending entry, so only the most recent could be approved.
- **Slack adapter config** — `SlackProvider` now accepts per-adapter options (`cards`, `formatToolCall`, `formatError`, `streaming`, `toolDisplay`) directly at the top level instead of nesting under `adapterConfig`. The `adapterConfig` field still works as a deprecated fallback.
- **Slack manifest** — `assistant:write` is now part of `DEFAULT_BOT_SCOPES` and the generated manifest declares the matching `assistant_view` feature, so newly generated app manifests support the AI Assistant surface and thread context in DMs.
- **Logger propagation** — the Mastra logger is now propagated into `AgentChannels` on register so channel-level logs flow through the configured logger.
