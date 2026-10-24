---
'@mastra/core': minor
'@mastra/memory': minor
---

Changes to an experimental, upcoming memory feature.

`experimental_subconscious` and the Memory `knowledge` option are removed; attach Knowledge to the agent instead.

A message can carry its own scopes: `session.sendMessage({ content, scopes })`. A run's scopes are fixed when it starts, so a message whose scopes differ from the running run's waits for it to end, then starts its own run in the same conversation. `sendSignal` reports this as `{ action: 'blocked', reason: 'scope-mismatch', runId }`.
