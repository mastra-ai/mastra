---
'@mastra/factory': patch
---

Improved how streamed replies move: one document, one pace, and a transcript that stops shifting under the reader.

**Fixed**

- A reply streams in the order it was written, on one clock: prose reveals word by word (thinking passages included), tool rows and cards land between the words they were written between, and a burst of parallel calls cascades in one at a time instead of dropping as a block.
- Rows no longer replay their entrance mid-run. Adopting the server's message id, the run rotating its message at a step, a slot getting its content, or a tool run ending all used to remount rows the reader was watching — a row now keeps its bubble, its element and its place from the moment it lands.
- Reply text split across content blocks is parsed as one markdown document, so a list item cut mid-stream no longer renders as an empty bullet followed by a paragraph.
- Focusing the window mid-run no longer duplicates the streaming reply or jumps the scroll.
- Steering a running reply no longer clears the view: the steer slides in under the stream instead of parking at the top with an empty screen of room beneath it, and steering while scrolled up brings the reader back to the live end.
- An agent question fills its reserved slot without rebuilding the text around it, and the "Thinking" line settles its sweep and fades under the first output instead of vanishing mid-sweep.

**Changed**

- Sending a message parks it near the top of the view with most of the screen reserved beneath, so the answer grows into empty space and nothing moves while it fits that room.
- Opening a thread that is still answering follows the stream from the live end, instead of holding the reading position it restored.
- A run of tool calls the reader watched arrive stays expanded. Compacting into a "N steps" row is what reloaded history does; a live turn stays as it played, including in a session opened mid-run.
- The timestamp and copy button land once, under the finished reply, and copy the whole answer — instead of once per persisted step, mid-run.
- Long transcripts redraw only the entry a token changed, so streaming stays responsive.
