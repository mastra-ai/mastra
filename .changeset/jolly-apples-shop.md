---
'@mastra/core': minor
---

Durable agents no longer persist `running` checkpoints by default, and `createDurableAgent()` accepts a new `shouldPersistSnapshot` option to control snapshot persistence ([#23915](https://github.com/mastra-ai/mastra/issues/23915)).

Previously, durable agents wrote a full workflow snapshot to storage on every step of every run, including `running` checkpoints that are only read by crash recovery. With recovery left at its default (`recovery.durableAgents: 'off'`), those writes were pure overhead — a single agent turn could generate over a thousand storage statements.

**What changed**

- Durable agents still always persist `pending`, `paused`, and `suspended` snapshots, so human-in-the-loop resume and tool approval keep working with no configuration.
- `running` checkpoints are now only written when the Mastra instance sets `recovery.durableAgents: 'auto'`, which is the setting that consumes them.
- `createDurableAgent()`, the `DurableAgent` constructor, and the agent-level `durable` config accept a `shouldPersistSnapshot` predicate to override the policy.
- Mastra logs a warning if a custom predicate excludes `suspended` or `paused` (breaks human-in-the-loop resume), or excludes `running` while automatic recovery is enabled (makes the agent invisible to recovery).
- Evented agents are unaffected: they always persist the full snapshot set (their engine coordinates workers through storage) and log a warning if `shouldPersistSnapshot` is set.

**Action required if you use manual recovery**: if you call `listActiveRuns()`, `recover()`, or `recoverActiveRuns()` without setting `recovery.durableAgents: 'auto'`, opt back into `running` checkpoints:

```typescript
const durableAgent = createDurableAgent({
  agent,
  shouldPersistSnapshot: ({ workflowStatus }) => ['pending', 'paused', 'suspended', 'running'].includes(workflowStatus),
});
```
