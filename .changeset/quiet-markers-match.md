---
'@mastra/core': patch
---

Fixed a stored message that gained an Observational Memory marker (`data-om-*` parts such as the observation end marker or status) being treated as a new message when it was loaded back into the live message list on the next turn. The message was added a second time, duplicating its content in the prompt and re-sending provider reasoning items. A stored copy that differs from the live message only by these markers is now recognized as the same message.
