---
'@mastra/core': patch
---

Fixed durable and evented agents ignoring per-model `modelSettings` in a model list. When an agent is configured with `model: [{ model, modelSettings: { temperature: 0.1 } }, ...]`, each entry's settings now reach the provider on every attempt, including retries and fallbacks, instead of falling back to call-time settings.
