---
'@mastra/core': minor
'@mastra/slack': minor
---

Added a `toolApprovers` adapter option that controls who can answer tool approval cards. The default, `'requester'`, keeps the current behavior: only the user whose message triggered the tool call can approve or deny it. Set `toolApprovers: 'anyone'` when a channel acts as one shared identity, so any channel member can answer. The session resolver still runs for the user who clicks.

```ts
new SlackProvider({ toolApprovers: 'anyone' })
```

Fixes #26502.
