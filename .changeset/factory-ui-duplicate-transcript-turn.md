---
'@mastra/factory': patch
---

Fixed assistant turns showing up twice in the chat transcript, with the first copy stripped of the tool cards that belong to it.

Tool cards stay attached to the text they ran under. The double came from the same turn arriving under a second identity after a stream gap; the transcript now recognises that copy as the turn it is already drawing and updates it in place.
