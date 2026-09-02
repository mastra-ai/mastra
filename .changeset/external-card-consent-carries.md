---
'@mastra/factory': patch
---

Fixed issues and pull requests from outside the write-access circle asking for approval again at every lane after a person already started them. Starting, dragging, or approving a run on such a card now carries that consent through the runs its own agent queues on the way to review, so one gesture takes the card to a pull request instead of one click per lane. Runs queued by a GitHub event on the card still ask first, and an agent still cannot pull a rested external card back into work.
