---
'@mastra/observability': patch
---

Fixed `MODEL_INFERENCE` spans losing `responseModel` when the model call is recorded from the raw provider stream. The provider names the model that actually served the request in an earlier `response-metadata` chunk, while the raw `finish` chunk carries no model id, so the span was exported without `responseModel` and cost estimation and exporters fell back to the requested model. The serving model is now captured per stream and attached to the span. Fixes [#29779](https://github.com/mastra-ai/mastra/issues/29779).
