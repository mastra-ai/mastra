---
'@mastra/core': patch
---

Fix generateTitle for pre-created threads

- Generate titles for existing threads: threads without `metadata.titleGenerated` will have a title generated on the next message when `generateTitle: true` is enabled
- Preserve custom titles on pre-created threads unless `metadata.titleGenerated` is explicitly set
- Opt out of title generation by setting `metadata.titleGenerated: true` when creating a thread

Fixes #11757
