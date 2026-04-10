---
'@mastra/observability': patch
---

Fixed `MODEL_STEP` input previews to stay shallow so large multi-turn conversations no longer trigger expensive deep serialization during observability span creation.

`MODEL_STEP` spans now store a lightweight message preview for parsed request bodies instead of recursively walking the full request payload. This keeps exporter input readable while avoiding timeout-sized work when `serializationOptions.maxDepth` is set higher.
