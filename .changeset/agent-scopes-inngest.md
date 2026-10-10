---
'@mastra/inngest': patch
---

Inngest agents now honor agent `scopes`. Memory identity comes from `resource:` and `thread:` scopes, tools and processors see the other scopes, and a resumed run keeps the scopes it started with. Resuming with a scope the run did not hold throws an error.
