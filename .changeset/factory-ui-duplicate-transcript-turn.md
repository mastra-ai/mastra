---
'@mastra/factory': patch
---

Fixed assistant turns showing up twice in the chat transcript, with the first copy stripped of the tool cards that belong to it.

The duplicate showed up when a reply came back under a second identity: the server stores a long turn as several messages, and a refetch after a stream gap brings those copies back. The transcript now recognises such a copy as the turn it is already drawing and updates it in place, so the tool cards stay with the text they ran under and nothing lands on screen twice.
