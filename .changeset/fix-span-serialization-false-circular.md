---
'@mastra/observability': patch
---

fix: prevent false [Circular] and [MaxDepth] in span serialization — replace global seen-set with ancestor-based WeakSet to distinguish true cycles from legitimate repeated references
