---
'@internal/mastra-factory': patch
---

Carry pull request review feedback back to the agent that wrote the code.

A `changes_requested` review is meant to wake the authoring work session, but
when the pull request carried no provenance the event resolved to the pull
request's own Review card. `addressReviewFeedback` deliberately refuses to act
on the review board — a Review card reacting to its own posted review would loop
the reviewer against itself — so the wake was dropped and the author never heard
about the feedback.

Review and pull request comment events now follow the linked card's
`parentWorkItemId` back to the item that authored the pull request, so the
existing guard becomes true for the right item instead of never. A pull request
card with no authoring item still emits nothing.
