---
'@mastra/client-js': minor
'@mastra/server': patch
'mastra': patch
---

Added a `tag` selector to `getAgent()` for loading the version of an agent that a version tag points at.

```typescript
const agent = mastraClient.getAgent('support-agent', { tag: 'production' });
const details = await agent.details();
```
