---
'@mastra/playground-ui': patch
---

Fixed the conversation timeline hover preview clipping its last line: the hidden element used to size the card measured the text at the wrong width, so a long prompt made the card too short for the reply underneath.
