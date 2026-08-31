---
'@mastra/core': patch
---

Fixed durable agent traces being polluted by output-stream processor spans. The durable per-chunk processor pipeline ran without a tracing context, so every `output stream processor` span exported with no parent. Span stores that label a trace by its newest root row then showed a processor id instead of the agent.

- Output-stream processor spans now nest under the run's `agent run` span.
- Tool-call chunks and resumed runs parent their processor spans the same way.
- The tool-call pipeline ends its processor spans right after each chunk, so none stay open.
- Callers without a tracing context no longer create processor spans, so orphan trace roots can never appear.

Fixes #22602
