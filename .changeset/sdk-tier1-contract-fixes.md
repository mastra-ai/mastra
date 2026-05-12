---
'@mastra/client-js': minor
---

Fix client-js bugs surfaced by the SDK ↔ server contract audit.

- `MastraClient.getAgentBuilderActions()` previously requested `/agent-builder/` (trailing slash) and 404'd. Now hits `/agent-builder`.
- `AgentBuilder.stream(params, runId)` now requires `runId`. The server route requires it; calls without it failed with a server-side validation error. The SDK now both types `runId` as required and guards at runtime.
- `MastraClient.createStoredSkill(...)` now requires `description` in its parameter type. The server schema has always required it; the SDK type used to mark it optional, so omitting it produced a runtime 400 instead of a compile error.

Migration:

```ts
// Before
await agentBuilder.stream({ inputData });

// After
await agentBuilder.stream({ inputData }, runId);
```

```ts
// Before
await client.createStoredSkill({ name, instructions });

// After
await client.createStoredSkill({ name, description, instructions });
```
