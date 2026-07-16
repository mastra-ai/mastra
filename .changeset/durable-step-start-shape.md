---
'@mastra/core': patch
---

Durable agents now emit `step-start` stream chunks in the canonical `ChunkType` shape (`{ type, runId, from, payload }`), matching the regular engine. The durable stream adapter previously published the fields flat on the chunk (`{ type: 'step-start', stepId, request, warnings }` — no `payload`, no `runId`/`from`), and since the observe-side consumer enqueues the event data verbatim, every chunk consumer that destructures `chunk.payload` crashed on durable `stream()`/`observe()` — e.g. `@mastra/ai-sdk`'s chunk converter with "Cannot destructure property 'messageId' of 'chunk.payload' as it is undefined". The payload now also carries `messageId` for parity with the regular engine's `step-start`.
