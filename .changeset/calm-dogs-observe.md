---
'@mastra/memory': patch
---

Avoid applying observational memory temperature defaults to custom models unless explicitly configured.

The Observer (`0.3`) and Reflector (`0`) temperature defaults are now applied only when the resolved model is known to support temperature, so models that reject the parameter no longer fail the observation call. Explicit `modelSettings.temperature` values are always preserved.

Token-routed models selected with `ModelByInputTokens` now receive the `maxOutputTokens: 100_000` default. Previously only the built-in default model selection received it, which left routed models without an output-token budget.
