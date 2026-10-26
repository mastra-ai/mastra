---
'@mastra/core': patch
---

Fixed agent streams dropping chunks when a run fails while the reader is behind. Before, a reader that consumed `fullStream` slowly, or started reading late, could lose the chunks already produced, such as the tool call and tool result, and get only the error. Now it receives every queued chunk first, then the error. This covers the default agent loop, durable agents, and late subscribers to an already-failed stream.
