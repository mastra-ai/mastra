---
'mastracode': patch
---

Fixed tokens-per-second accounting in Mastra Code by including streamed thinking and tool arguments in decode timing and counting provider-reported output tokens only once. Initial waiting and subsequent tool execution are excluded, and when thinking was never streamed the rate reports the output that was actually visible instead of disappearing. Buffered output can still cause temporary spikes.
