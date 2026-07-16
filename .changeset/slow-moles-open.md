---
'@mastra/core': minor
---

Added access to the workspace resolved for an AgentController session.

Use the session-owned workspace when an operation must remain isolated to that session:

```ts
const session = await controller.createSession({ resourceId, scope });
const workspace = session.getWorkspace();
```
