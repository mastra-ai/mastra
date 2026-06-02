---
'@internal/playground': patch
---

Fixed the agent-builder chat dropping the user message after a page reload. User turns are persisted as `role: 'signal'` messages, but the playground's assistant-ui converter mapped every signal to `role: 'system'`, so the reloaded user message was hidden. The converter now mirrors core's adapters: signals whose type is `user` or `user-message` render as a user message, while all other signals stay `system`.
