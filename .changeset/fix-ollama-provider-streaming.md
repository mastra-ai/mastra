---
'@mastra/core': patch
---

Fixed a catch-22 where third-party AI SDK providers (like `ollama-ai-provider-v2`) were rejected by both `stream()` and `streamLegacy()` due to unrecognized `specificationVersion` values.

When a model has a `specificationVersion` that isn't `'v1'`, `'v2'`, or `'v3'` (e.g., from a third-party provider), two fixes now apply:

1. **Auto-wrapping in `resolveModelConfig()`**: Models with unknown spec versions that have `doStream`/`doGenerate` methods are automatically wrapped as AI SDK v5 models, preventing the catch-22 entirely.

2. **Improved error messages**: If a model still reaches the version check, error messages now show the actual unrecognized `specificationVersion` instead of creating circular suggestions between `stream()` and `streamLegacy()`.
