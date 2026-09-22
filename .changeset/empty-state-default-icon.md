---
'@mastra/playground-ui': patch
'@mastra/playground': patch
---

`EmptyState` now renders a default `CircleSlashIcon` when `iconSlot` is omitted; `iconSlot` is optional (pass `null` for no icon). All playground callsites drop their explicit `iconSlot`.
