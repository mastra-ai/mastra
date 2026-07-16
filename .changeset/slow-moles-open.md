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

Mastra Code workspace resolvers can now accept an isolated read-only skill extension. Mastra Code Web uses this seam to expose its server-owned `understand-issue` and `understand-pr` `SKILL.md` assets to Factory sessions without adding them to default SDK or TUI workspaces.
