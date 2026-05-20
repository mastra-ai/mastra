---
'@mastra/core': minor
'@mastra/slack': patch
---

Add `plan` mode to channel adapters — render an LLM-driven plan block per
thread instead of cards or inline tool entries:

- New `plan` option on `ChannelAdapterConfig` and `SlackProviderConfig`:
  `plan: true` (defaults to `{ toolDisplay: 'inline' }`) or
  `plan: { toolDisplay?: 'inline' | 'hidden', initialMessage?, completeMessage? }`.
  Mutually exclusive with `toolDisplay` / `cards` / `formatToolCall`.
- Auto-injects five plan tools modelled after the mastracode `task_*` API:
  `task_write`, `task_update`, `task_complete`, `task_check`, `complete_plan`.
  These are added to the agent whenever any adapter has `plan` set; the LLM
  drives the plan widget directly.
- Non-plan tool calls fold under the currently in-progress plan task
  (`'inline'`, the default) or execute silently (`'hidden'`).
- Plan state is persisted to the Mastra thread metadata under `channelPlan`,
  so plans survive across multi-turn conversations and server restarts. On
  rehydration the channel posts a fresh widget and replays the persisted
  task list.
- `complete_plan` refuses to finalize while pending or in-progress tasks
  remain unless called with `force: true`.
