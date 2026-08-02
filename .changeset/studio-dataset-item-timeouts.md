---
'@internal/playground': patch
---

Studio now lets you configure a per-item execution timeout on dataset items. Set an optional timeout when creating an item, edit it later from the item detail panel or the item versions page, and see the saved override in the item details. Timeouts are whole milliseconds from 1 to 1,800,000 (30 minutes) and override the experiment-level fallback for that item.
