---
'@mastra/client-js': patch
---

Span types returned by the trace and span endpoints now include `timeToFirstChunkMs`, the milliseconds from span start to the first streamed chunk.
