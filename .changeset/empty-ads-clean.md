---
'@mastra/dynamodb': patch
---

Fixed an issue where automatic thread title generation was skipped when using the DynamoDB storage adapter. The adapter was overwriting empty thread titles with a `Thread <id>` placeholder on save, which prevented the title-generation step (gated on an empty title) from running. Empty titles now round-trip correctly so generated titles work the same as with other storage adapters. Resolves #15998.
