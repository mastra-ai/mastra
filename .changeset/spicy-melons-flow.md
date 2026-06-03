---
'@mastra/react': patch
---

Fix the `MessageFactory` `SourceUrl` renderer never firing for runtime `source-url` parts.

The accumulator emits a flat `type: 'source-url'` citation part, but `MessageFactory` only matched the legacy nested `type: 'source'` discriminant, so the `SourceUrl` renderer was unreachable at runtime. The shared `AIV5Type.SourceUrlUIPart` type is now a first-class member of the accumulator union, and both the `source` and `source-url` discriminants are routed to `SourceUrl` with a normalized flat shape (`sourceId`, `url`, `title`, `providerMetadata`).

Also exports the narrowed part types used by `MessageFactory` renderers so consumers can type their own components: `TextPart`, `ReasoningPart`, `FilePart`, `StepStartPart`, `ToolInvocationPart`, `SourceDocumentPart`, and `SourceUrlPart`.
