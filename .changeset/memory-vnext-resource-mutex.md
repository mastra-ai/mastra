---
'@mastra/memory': patch
---

Fixed concurrent vNext working memory updates (`__experimental_updateWorkingMemoryVNext`) from different threads overwriting each other when working memory uses the default resource scope. The lock is held per `Memory` instance, so separate instances that share storage can still overwrite each other.
