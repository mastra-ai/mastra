---
'@mastra/core': minor
---

Added `allowedWorkspaceTools` to `HarnessSubagent`. Subagents now automatically inherit the parent agent's workspace. Use `allowedWorkspaceTools` to restrict which workspace tools a subagent can see:

```ts
const subagent: HarnessSubagent = {
  id: 'explore',
  name: 'Explore',
  allowedWorkspaceTools: ['view', 'search_content', 'find_files'],
};
```
