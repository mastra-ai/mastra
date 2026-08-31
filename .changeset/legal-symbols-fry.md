---
'@mastra/core': patch
---

Fixed durable agent traces being polluted by output-stream processor spans. The durable per-chunk processor pipeline ran without a tracing context, so every `output stream processor` span exported with no parent — creating orphan trace roots that could rename the whole trace in span stores (the trace list then showed a processor id instead of the agent). These spans now nest under the run's `agent run` span, including tool-call chunks and resumed runs, and the tool-call pipeline ends its processor spans as soon as its chunk is processed. A processor span whose ancestors cannot reach exporters is no longer created at all, so context-less callers can never mint orphan trace roots. Fixes #22602
