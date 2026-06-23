---
'@internal/playground': patch
'@mastra/playground-ui': patch
---

Added Studio support for authoring and viewing item-level tool mocks on dataset items.
Added trace-derived mock creation with an editable preview before saving to a new or existing item.
Added tool mock propagation when creating new items and creating datasets from items.
Improved experiment results with a tool mock report (served, unconsumed, live calls, and mismatch details).

Author tool mocks on a dataset item as a JSON array:

```json
[
  {
    "toolName": "refundUser",
    "args": { "user": "YJ", "amount": 100 },
    "output": { "refundId": "refund_1", "user": "YJ", "amount": 100, "newBalance": 100 }
  }
]
```
