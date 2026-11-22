---
'@mastra/core': minor
---

Added an optional `recommended` flag to `ask_user` options. The flag reaches the host in the suspend payload, so a UI can highlight the choice the agent suggests. It is a display hint only: nothing is selected until the user answers.

```ts
// suspendPayload.options from a suspended ask_user call
[{ label: 'staging', recommended: true }, { label: 'production' }];
```
