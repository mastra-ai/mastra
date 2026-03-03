---
'@mastra/memory': patch
---

Stop auto-applying `maxOutputTokens: 100_000` to observer and reflector models when users supply their own model.

Previously, the 100k default was always injected regardless of model choice. Now it is only applied when using the built-in default model (`google/gemini-2.5-flash`). If you set a custom `observation.model` or `reflection.model`, no `maxOutputTokens` default is added — pass it explicitly in `modelSettings` if your model needs it.
