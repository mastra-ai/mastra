---
'@mastra/factory': patch
---

The factory chat now follows the agent as it works. Sending a message scrolls once, parking your message near the top with room under it, and the view then stays on the newest output — tool progress, subagents, the streamed reply — instead of standing still or jumping back up to the message you just sent. Scroll up to read back and the chat stops following; return to the bottom and it picks the stream back up.

That room is held open only while the agent works. It opens under the turn you just sent and closes when the run ends, both on the same eased curve, so a finished conversation settles against the composer instead of leaving most of the window blank — and a run that ends while the room is still opening reverses from wherever it got to rather than snapping. The thinking line fades in with it.

Two things used to move the transcript a second time, a beat after sending. The run echoes your message back as its own signal row, which draws nothing on screen — it was still treated as a new turn, so the reserved room jumped from the message you can see to an empty group, closing under one and reopening under the other just as the reply started. A turn is now what you can see: only a drawn message opens one, and it keeps its room for the whole answer.

A time separator like `24 minutes later` is written a moment after the message it introduces and belongs above it, which used to shove the whole transcript down a second after sending. It is now part of the turn it announces, so it lands inside that reserved room and nothing else moves.

The jump-to-latest button also stops flickering on send: it now tracks whether you are attached to the stream rather than how far the end happens to be, so output arriving cannot make it appear while the chat is already carrying you there.
