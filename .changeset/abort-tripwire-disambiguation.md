---
'@mastra/core': patch
---

Fix `agent.generate()` / `.stream()` reporting a caller `abortSignal` cancellation as a processor tripwire. When a run is aborted and no processor triggered a tripwire, the result now reports `finishReason: 'aborted'` and leaves `tripwire` undefined, instead of synthesizing a generic `{ reason: 'Processor tripwire triggered' }`. Genuine processor tripwires are unaffected.
