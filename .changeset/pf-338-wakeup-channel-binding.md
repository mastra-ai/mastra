---
'@mastra/core': patch
---

Fixed channel wakeups with stale or mismatched bindings: they now stop before admission and are marked as `channel_binding_closed`.
