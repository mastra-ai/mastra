---
'@mastra/playground-ui': patch
---

Traces filter bar (on `/traces` and agent traces) now supports advanced AND/OR filter groups. Groups are persisted in the URL as `filterGroup` params, restored from saved filters, and sent to `queryTraces` as nested `or` / `and` predicates. `FilterBar`'s `createItemId` now only applies to root-level items so a group can hold several conditions on the same field.
