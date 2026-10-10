---
'@mastra/core': patch
---

Fixed durable agents saving raw model output after `processOutputStream` changed or removed streamed text. Stored text now matches the stream, as it does for regular agents. Redacted values no longer reappear on reload or reach the model on a later turn.
