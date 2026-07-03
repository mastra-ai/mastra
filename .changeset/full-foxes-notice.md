---
'@mastra/core': patch
---

Fixed durable agent parity gaps for structured output, output processors, callbacks, error processors, suspend/resume, and tool lifecycle hooks. Durable agents now support structured output schemas, per-chunk output processor streaming, onStepFinish/onFinish/onError callbacks, error processor retry loops, tool context.writer chunks, and suspend/resume with proper data flow. These fixes bring durable agent scenario test coverage from 43% to over 90%.
