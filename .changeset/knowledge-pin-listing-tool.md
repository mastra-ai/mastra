---
'@mastra/core': minor
---

Agents can pin a listing of the Knowledge page tree with `knowledge_pin`. Pass `kind: 'list'` and an optional `depth` (1 to 3, default 1) to pin the pages under a page instead of the page itself:

```json
{ "op": "pin", "kind": "list", "depth": 2, "page": "docs:acme#guides", "audience": ["org:acme"] }
```

A page can hold a page pin and a listing pin at once; each is pinned and unpinned on its own, and pinning a listing again sets its new depth. Stored listings follow the same rules as config listings: only pages the run can read, one pin slot, shared `pinnedContext.maxTokens`. A stored listing that repeats a config listing is shown once.

Knowledge storage adapters store a pin `kind` (`page` or `list`) and a list pin's `depth`. With a storage adapter from before this release, page pins keep working and pinning a listing is refused with a message to upgrade the adapter.
