---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed the goal box appearing twice in the transcript.

Starting or resuming a goal drew the goal box locally and the agent also echoed the same reminder back into the live transcript, so the goal was shown twice in a row. The box is now rendered once, from the echoed reminder.

The reminder keeps the goal's attempt budget and judge model, so the box shows both instead of dropping the attempt count. The same reminder is also deduplicated, so a repeated signal cannot render the box a second time.
