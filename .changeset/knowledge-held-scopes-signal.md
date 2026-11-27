---
'@mastra/core': minor
---

Added a held-scopes list to the context of agents with Knowledge tools and Memory, so they know where they can read and write before they call a tool. The list names every scope the run has a role on, with that role, including scopes with no pages yet. The first turn gets the full list; later turns get only what changed, such as a scope added, a role changed, or access removed.

```
<knowledge-scopes>
  Your session has access to:
  - org:acme (editor)
  - docs:acme (viewer)
  - thread:t-1 (owner)
</knowledge-scopes>
```

If the scopes can't be read, the turn fails instead of telling the agent it holds none.
