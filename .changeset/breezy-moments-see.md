---
'@mastra/client-js': patch
---

Fixed `@mastra/client-js` so client-side tools with Zod `inputSchema`, `parameters`, or `outputSchema` are serialized to JSON Schema before requests are sent.

Client tools with `execute` functions no longer trigger OpenAI `"Invalid schema for function"` errors when they include Zod schemas.

Fixes #11668. Alternative to #11787.
