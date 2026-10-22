---
'@mastra/client-js': patch
---

Fixed per-call abortSignal cancellation for durable agent streaming, resumption, and tool approval or decline. The SDK explicitly cancels the run, retrying briefly while it registers and bounding cancellation requests to 10 seconds. Cancelling response.body or the client-wide signal still only detaches the observer.
