---
'@mastra/factory': patch
---

Fixed issues and pull requests from outside the write-access circle asking for approval again at every lane after a person had already started them. Starting, dragging, or approving a run on such a card now carries that consent through the runs queued by the card's agent on its way to review. One gesture takes the card to a pull request instead of one click per lane. The same holds when a person creates a card straight into a working lane or moves it there through the API, and when the card's agent moves it on from a chat: the run queued by that move no longer waits for a click. Runs queued by a GitHub event on the card still ask first. An agent still cannot pull a rested external card back into work. A run pre-approved by an agent opens its session under the repository connector, never under the agent's id.
