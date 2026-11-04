---
'@mastra/core': patch
---

Fixed agent sessions never emitting `message_end` for the assistant message when a turn ends in a tool suspension, for example `ask_user`. In those turns, the assistant message now ends before `agent_end`.
