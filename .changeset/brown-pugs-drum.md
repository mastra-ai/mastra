---
'@mastra/core': patch
---

Fixed dynamic workflows so object-form mapping configs keep working. Passing `mapConfig` as an object to `addDynamicWorkflow` previously failed at run time with `"[object Object]" is not valid JSON`; it now stays intact when the workflow is registered, saved, and loaded.
