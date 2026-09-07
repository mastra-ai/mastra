---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed durable agents looping until maxSteps when a provider ends the stream with finishReason 'other' and no output. The empty response now surfaces as a stream error after one attempt, and completion checkers no longer grade errored iterations (ports #22273 to the durable agent loop).
