---
'@mastra/core': patch
---

Fixed fallback model attribution in observability traces. When an agent switched to a fallback model after the primary failed, exporters like Langfuse still labelled the generation with the primary model, causing usage and cost to be misattributed or dropped. The MODEL_GENERATION span is now re-stamped with the active fallback model so traces reflect the model that actually served the response.
