---
'@mastra/client-js': patch
---

Preserve `providerMetadata` on tool-invocation parts during recursive client-tool streams. Fixes Gemini thinking models failing with `Function call is missing a thought_signature` after a `clientTools` round-trip.
