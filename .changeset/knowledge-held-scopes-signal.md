---
'@mastra/core': minor
---

Added a held-scopes list to the context of agents with Knowledge tools and Memory, so they know where they can read and write before they call a tool. Each turn's context lists every scope the run holds, with what the agent can do there (`write`, `read` or `none`) and its role, including scopes with no pages yet. The first turn gets the full list; later turns get only what changed, such as a scope added to the run or a role that changed.

```
<knowledge-scopes count="3">
  • org:acme: write (editor)
  • docs:acme: read (viewer)
  • thread:t-1: write (owner)
</knowledge-scopes>
```

If the scopes can't be read, the turn fails instead of telling the agent it holds none.
