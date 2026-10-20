---
'@mastra/core': patch
---

Fixed durable and evented agents placing `isTaskComplete` feedback after the model's next tool call and its result. The feedback now comes right before the model's retry, as it does with regular agents, so the model reads it as the reason for continuing. Fixes #27548.
