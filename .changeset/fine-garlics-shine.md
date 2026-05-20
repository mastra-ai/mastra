---
'@mastra/core': patch
---

Fixed authorization and request-context checks in legacy agent execution methods.

`generateLegacy()` and `streamLegacy()` now enforce the same authorization and request-context rules as `generate()` and `stream()`. When Fine-Grained Authorization (FGA) is enabled, these legacy methods require an authorized user in the request context and throw `FGADeniedError` when authorization fails. Agents with a request context schema now validate that schema before legacy execution. Behavior is unchanged for legacy calls that use neither FGA nor a request context schema.
