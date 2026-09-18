---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed the goal box appearing twice in the transcript.

Starting or resuming a goal drew the goal box locally and the agent also echoed the same reminder back into the live transcript, so the goal was shown twice in a row. The box is now rendered once, from the echoed reminder.

The reminder also carries the goal's attempt budget again, so the box reads "Goal (500 max attempts, judge: ...)" instead of dropping the attempt count.
