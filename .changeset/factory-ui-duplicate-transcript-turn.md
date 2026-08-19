---
'@mastra/factory': patch
---

Fixed assistant turns showing up twice in the chat transcript, with the first copy stripped of the tool cards that belong to it.

A turn can reach the transcript under two identities: the run loop hands the engine a message id that the engine only adopts while its own message is still empty, and a refetched window after a stream gap brings the persisted copy back. The transcript now recognises a message that extends what is already drawn as that same turn and rewrites it in place, instead of drawing a second copy and moving the tool parts over to it.
