---
'@mastra/factory': patch
---

Factory now remembers a maintainer's acceptance of non-bug work. Triage classifies feature requests, questions and docs as needing a person's decision; before, that decision was checked again on every later agent move, so a card a maintainer had dragged into Planning still stalled when the plan agent tried to advance it to Build.

- The first time a person moves a held card into Planning or Build, the acceptance is recorded on the work item. Later agent transitions along the working lanes proceed without a second gesture, and the gate only guards the exit from Intake/Triage. Cards accepted before this release are recognised by their stage, and pick up the record on their next human move.
- On acceptance, the GitHub `status: needs approval` label is removed automatically (best effort; a label failure never blocks the move).
- A held card on the board leads with the decision — **Accept and plan**, **Accept and build**, or **Close** — and says why it waits (`Feature request · needs your approval`). Runs, re-runs and suggested runs on that card are withheld until it is accepted, so nothing advances it as a side effect. Bugs are never held.
