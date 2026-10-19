---
'@mastra/core': minor
---

Span records now carry `timeToFirstChunkMs`, the milliseconds from span start to the first streamed chunk. The storage exporters fill it in, so storage adapters save the value without computing it.
