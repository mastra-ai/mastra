---
'@mastra/core': minor
'@mastra/slack': patch
---

Add `toolDisplay` config to channel adapters for controlling how tool calls
render in chat:

- `'cards'` (default) — per-tool running/result cards (unchanged behavior).
- `'timeline'` — task chunks streamed inline with text (Slack only today).
- `'grouped'` — task chunks combined into one plan block (Slack only today).
- `'hidden'` — tools run silently; only the typing status indicates work.

`'timeline'` and `'grouped'` require `streaming: true` and rely on the
underlying chat adapter to render `task_update` chunks. If `streaming` is
disabled, the channel logs a one-time warning and falls back to `'cards'`.
Adapters without native `task_update` support (e.g. Discord today) may render
a placeholder.

Approve/deny prompts (`requireApproval`) always render as a separate card
regardless of mode, because inline task entries can't carry interactive
buttons.
