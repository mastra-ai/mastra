---
'@mastra/core': minor
---

Update the experimental AgentController message surface to use the canonical `MastraDBMessage` shape.

The AgentController now emits, persists, and returns DB-native messages where message parts live under `content.parts`, and terminal status lives under `content.metadata`. Signals such as system reminders and notifications now arrive as separate messages with `role: 'signal'` instead of being flattened into assistant message content.

This affects the experimental AgentController event and session APIs, including `message_start`, `message_update`, `message_end`, `currentMessage`, `listMessages`, `listActiveMessages`, `firstUserMessage`, and `firstUserMessages`.
