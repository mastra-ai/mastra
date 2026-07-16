---
'@mastra/core': minor
'@mastra/code-sdk': minor
---

Added access to the workspace resolved for an AgentController session.

Use the session-owned workspace when an operation must remain isolated to that session:

```ts
const session = await controller.createSession({ resourceId, scope });
const workspace = session.getWorkspace();
```

Mastra Code workspaces now include the server-owned `understand-issue` and `understand-pr` skills as ordinary read-only `SKILL.md` assets. Local and sandbox-backed sessions can resolve them through `workspace.skills` without copying files into the connected repository.
