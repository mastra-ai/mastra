---
'@mastra/factory': minor
---

A stored agent phase now names a `context` instead of a `seat`. Any key works: phases with the same context continue one session, a new context starts a fresh one, and `null` runs the phase in the card's main context. Boards stored with `seat` keep working.

```ts
{ key: 'docs', name: 'Docs', kind: 'working', runner: { type: 'agent', agentId: 'code-agent', skill: 'write-docs', context: 'docs' } }
```
