---
'@mastra/factory': patch
'mastra': patch
---

Factory no longer sends or expects a `sandboxProvider` value when linking a repository during setup. Update `mastra` together with `@mastra/factory`: repository linking fails when one of them is older than the other.
