---
'@mastra/core': patch
---

Fixed agent sessions never emitting `message_end` for the assistant message when a turn ends in a tool suspension, for example `ask_user`. Every `message_start` now has a matching `message_end` before `agent_end`.
