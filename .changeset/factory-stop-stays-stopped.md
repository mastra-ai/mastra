---
'@mastra/factory': patch
---

Pressing Stop on a card's run now stops it. Before, the Factory restarted the run a few seconds later and posted the stage-move message again, such as "This work was moved from the intake stage to the pr-review stage." A stopped run now shows as "Stopped by a person", and you can start the stage again from the card. Runs that end for other reasons, such as a server restart, still retry on their own.
