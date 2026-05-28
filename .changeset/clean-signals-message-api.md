---
"@mastra/core": minor
---

Add experimental `agent.sendMessage()` and `agent.queueMessage()` APIs for sending user-authored input into agent threads.

This also normalizes signal categories so user messages use `type: 'user'` with `tagName: 'user'`, while preserving compatibility for legacy `user-message` and `system-reminder` signal payloads and stored records.
