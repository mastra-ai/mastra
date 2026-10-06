---
'@mastra/factory': patch
---

Fixed Factory Knowledge exploration to load a bounded scope tree before fetching the selected scope, with fail-closed keyed access.

When an org has more scopes than Factory reads (10,000 by default), the scope tree, graph, and search responses set `truncated: true` and the scope tree says some scopes are not shown. Opening a scope's graph or activity still works for any scope in the org.
