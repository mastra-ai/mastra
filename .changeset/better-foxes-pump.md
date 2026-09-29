---
'@mastra/observability': patch
---

Fixed failed model calls showing as successful in traces. The model span tracker can now record an error while leaving the inference, step and model spans open, so the normal stream end still closes them with their usual attributes.
