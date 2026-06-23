---
'@mastra/core': minor
'mastracode': patch
---

Moved the subagent model accessors off the Harness onto `session.subagents.model`. Reading and setting the global or per-`agentType` subagent model now lives on the session, next to the state it reads and writes, and is grouped under `session.subagents` to leave room for future subagent settings.

**Before**

```typescript
const modelId = harness.getSubagentModelId({ agentType: 'explore' });
await harness.setSubagentModelId({ modelId: 'anthropic/claude-sonnet-4', agentType: 'explore' });
```

**After**

```typescript
const modelId = harness.session.subagents.model.get({ agentType: 'explore' });
await harness.session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4', agentType: 'explore' });
```

`get()` prefers the per-`agentType` value, then the global subagent model, returning `null` when neither is set. `set()` persists to thread settings and emits a `subagent_model_changed` event. Removed `Harness.getSubagentModelId` and `Harness.setSubagentModelId`.

`mastracode` is updated to consume the new API: the `/subagents` command, model-pack activation, and startup model restoration read and set subagent models via `session.subagents.model`.
