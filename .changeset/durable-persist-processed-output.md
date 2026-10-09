---
'@mastra/core': patch
---

Fixed durable agents saving the raw model output to memory when an output processor rewrites the stream. Text changed or removed by `processOutputStream` (for example a redaction processor) is now stored exactly as it was streamed, matching regular agents, so redacted values no longer reappear on reload or get replayed to the model.
