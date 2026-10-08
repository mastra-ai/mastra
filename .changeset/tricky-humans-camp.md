---
'@mastra/factory': patch
---

Fixed the Factory Knowledge page for large orgs. The scope tree now loads in pages instead of all at once, and it always reads the Knowledge instance registered under the configured key. A request cannot select a different instance, and the page reports Knowledge as unavailable when that instance is not registered.

When an org has more scopes than Factory reads (10,000 by default), the scope tree, graph, and search responses set `truncated: true` and the scope tree says some scopes are not shown. Opening a scope's graph or activity still works for any scope in the org.
