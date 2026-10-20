---
'@mastra/core': patch
---

Fixed durable agent runs losing user input when a worker stops before the run finishes.

Durable runs now stop before calling the model when the accepted input cannot be saved — for example when the storage write fails or the caller has no write permission on the thread — instead of answering without persisting it. Memory configured with `readOnly` still runs without writing.
