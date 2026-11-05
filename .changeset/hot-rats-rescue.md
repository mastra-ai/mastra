---
'@mastra/core': patch
---

Fixed agent tool calls failing when the tool's input schema transforms values, for example a string decoded into a `URL` ([#27259](https://github.com/mastra-ai/mastra/issues/27259)). The call failed with errors like `url: Expected string` and the tool never ran. This happened on models without a schema compatibility layer, on tools with `strict: false`, and with `generateLegacy` / `streamLegacy`, where `generateLegacy` could also fail with `DataCloneError`.

Tool calls recorded by `generateLegacy` and `streamLegacy` now keep the arguments the model sent instead of the decoded values.
