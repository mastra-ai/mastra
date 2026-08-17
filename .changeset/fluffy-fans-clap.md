---
'@mastra/client-js': minor
---

Added `Agent.readPlan()` for loading submitted plan Markdown.

```ts
const agent = client.getAgent('agent-id');
const plan = await agent.readPlan('.mastracode/plans/add-dark-mode.md');
```
