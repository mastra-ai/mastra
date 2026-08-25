---
'@mastra/factory': patch
---

Streamed replies now arrive with one motion. Tool rows, tool groups, cards and the thinking line fade in on the same curve as the words around them instead of popping in with a slide. A tool's file path or command also fades in when it lands, instead of snapping into a card that was already drawn. Rows already on screen when a session is restored no longer replay their entrance.

A live turn now reserves a whole screen instead of 70% of one, so a reply grows into empty space and the transcript stops moving under the reader for as long as the reply fits the window.

A run of tool calls the reader watched arrive stays expanded. It used to collapse into a "3 steps" row as soon as the third call landed — taking back rows being read and shrinking the transcript under them. Compacting is now what history does: a reloaded reply groups its runs, a live one stays as it played.

Fixed rows flashing mid-run: an assistant entry adopted the server's message id when its canonical message landed, which remounted every row it held — open cards, group state and all — and replayed their entrance.

The copy button and timestamp under a message now wait for the reply to finish. They used to appear beside a reply that was still being written, offering to copy half a sentence.

A reply is stamped once, however many messages it is made of. The run engine sends a reply as one message but the server persists one per step, so a single answer reached the transcript as two — with a timestamp and a copy button sitting in the middle of it. The stamp now lands under the last message of the turn and copies the whole answer.

Long transcripts stay responsive while a reply streams: only the entry a token changed is drawn again, instead of every message on screen.

Sending a message parks it at the top of the view, with its answer growing into the space below. The transcript used to stay pinned to the bottom of its scroll box, which counted the reserved room and the composer as places to scroll to and carried the message just sent off the top.

A reply is drawn as one document. The model's text arrives as content blocks and a boundary falls wherever the stream cut it, so a reply built of several parts was parsed as several markdown documents — a list item whose text had been split rendered as an empty bullet followed by a paragraph, and each part streamed in at once instead of one word-by-word reveal. Parts of one answer are now joined before anything renders them.

A tool row stops flashing when its run ends. The row swapped the element holding it for a plain one as soon as the sweep stopped, which remounted the label, the path and every card under it — so a row the reader had been watching for a minute played its entrance again the moment it finished.

A reply arrives in the order it was written. The transcript paced each passage of prose on its own clock, so a tool row landed the moment the model called it — on top of a sentence still being laid down word by word, and cutting the reveal it was written after. One pace now runs the whole message: rows and cards wait for the words before them.

Parallel tool calls cascade in one at a time. The reveal clock now paces every part of a reply — rows and cards take a beat between the words they were written between — so a burst of simultaneous calls lands row by row at the pace the reply is moving, instead of dropping as one block, and a row never lands in the same instant as the words after it.

A session opened while its run is under way keeps live tool rows as rows. They used to keep folding into a "N steps" group as each new call landed — swallowing rows being read and cutting a running row's sweep mid-flight. What was already there when the reader arrived still compacts; what lands under them stays as it played.

An agent question fills its place in the reply without disturbing the text around it. The waiting slot used to be dropped from the reply and re-inserted when the prompt arrived, which rebuilt every part after it — the text below blinked and replayed its entrance.

The "Thinking" line now settles its sweep and fades when the run's first output arrives, instead of vanishing mid-sweep under it.

A reply's parts hold their place from the start. An empty reasoning block, a blank passage or a waiting question used to be dropped from the reply and re-inserted once it had content — which grew the script ahead of the reveal clock, pulled words already on screen back out of view, and replayed their entrance. A slot is now reserved by what a part is, never by what it currently says: it renders nothing until it has something, and the words after it never move.

A tool row stays in the bubble it landed in. The run rotates its assistant message at each step, and a call that started just before the rotation was claimed by the new message — the row the reader was watching was torn out of one bubble and replayed in the next, taking its open card and sweep with it. The row now stays where it played, the rotated message defers to it, and a lost result still reaches it; a reload draws canonical order.

The timestamp and copy button under a reply now wait for the whole answer. A reply is one message per step, and the stamp landed after every step — appearing with a copy button mid-run, then vanishing when the next step opened. The stamp lands once, when the run stops answering.

The thinking passage streams word by word on the same clock as the reply. It was treated as a block delivered whole — held back for one beat, then landed at once and grown raw as more thinking streamed in. Its words are now part of the reveal's script, so it is laid down at the pace it is written, and the prose after it waits its turn.
