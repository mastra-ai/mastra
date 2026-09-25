---
'mastra': patch
---

Fixed tokens-per-second readings in the bundled Mastra Code web interface. The rate now includes time spent streaming thinking and tool arguments, counts each output token once, and leaves out initial waiting and tool execution. When thinking was never streamed it reports the output that was visible instead of disappearing. Buffered output can still cause temporary spikes.
