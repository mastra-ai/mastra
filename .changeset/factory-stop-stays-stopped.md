---
'@mastra/factory': patch
---

Fixed Stop on a card's run being undone a few seconds later. The Factory used to restart the run and post the stage-move message again, such as "This work was moved from the intake stage to the pr-review stage." A stopped run now stays stopped, even when the Stop request reaches a different server than the one running it, and it is not reported as a failure: no error on the card, no failed review status, no failure report to the lead. Runs that end for other reasons, such as a server restart, still retry on their own.
