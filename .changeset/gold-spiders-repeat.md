---
'@mastra/core': patch
---

Added typed processor span payloads to `@mastra/core/processors`. Use `isProcessorSpan(span, phase)` and `getProcessorSpanPhase(span)` to narrow a stored `SpanRecord`'s `input`/`output` to the shape recorded for each processor phase (`input`, `inputStep`, `output`, `outputStep`, `toolResult`). These types are derived from the processor argument types, so adding a field to processor args now requires deciding whether it is recorded in traces.
