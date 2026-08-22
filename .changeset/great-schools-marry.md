---
'@mastra/core': patch
---

Stop `doGenerate()` from silently dropping AI SDK content parts it does not expand explicitly.

`createStreamFromGenerateResult()` converted a `doGenerate()` result with an if/else chain that ended at `source` and had no fallback, so any other content part was discarded without an error. The stream still carried `stream-start`, `response-metadata` and `finish`, which made the loss easy to miss.

The affected parts are `tool-approval-request` (provider v3 and v4) and `custom` plus `reasoning-file` (provider v4). They need no start/delta/end expansion because the spec's stream-part unions reuse the same content types verbatim, and `doStream()` already forwards them untouched. They are now forwarded unchanged, so the generate path is no longer lossier than the stream path and provider-specific content, generated reasoning files and required tool approvals reach stream consumers, output processors and message persistence.
