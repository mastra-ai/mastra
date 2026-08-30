---
'@mastra/editor': minor
---

Added label-aware stored-agent resolution that re-resolves movable pointers and fails closed for missing exact selectors.

```ts
await editor.agent.getById('agent-id', { label: 'candidate' });
```
