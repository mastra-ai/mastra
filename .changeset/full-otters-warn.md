---
'@mastra/observability': patch
---

Fixed `MODEL_INFERENCE` spans having no input. They now record the same input preview as their `MODEL_STEP` span, so exporters can show what was sent on each model call.
