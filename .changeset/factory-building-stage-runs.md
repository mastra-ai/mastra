---
'@mastra/factory': patch
---

Start the implementation run when a work item enters Building.

Building was the one stage on the Work board with no entry rule, so an item
arriving there stopped: the plan was approved and nothing picked it up until
somebody pressed Build by hand. Every other stage advances itself, which made
Building the single manual step in an otherwise continuous path from intake to
review.

The run it starts carries a prompt rather than activating a skill. Skills exist
here to define a handoff — a terminal message later rules match on to decide
what happens next — and Building already has one: it ends by opening a pull
request, which arrives as its own event and raises the Review card. Rules could
previously only express "invoke this skill", so the decision vocabulary now
accepts a prompt as the alternative to a skill name.
