---
'@mastra/memory': patch
---

Observational Memory no longer applies its temperature defaults to models that don't support temperature. Fixes #24060.

The Observer (`0.3`) and Reflector (`0`) defaults are now applied only when the resolved model is known to support temperature, on both observation and reflection calls. Models without known temperature support omit the parameter instead of receiving a value that fails the request and aborts the user's turn. Explicit `modelSettings.temperature` values are always preserved.

Token-routed models selected with `ModelByInputTokens` now receive the `maxOutputTokens: 100_000` default. Previously only the built-in default model selection received it, which left routed models without an output-token budget.
