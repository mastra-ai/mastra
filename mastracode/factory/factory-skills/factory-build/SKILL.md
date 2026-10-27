---
name: factory-build
description: Take a Factory work item back into Building after review asked for changes — address every finding, prove the fixes with tests, push, and hand it on again
---

# Factory Build

Review sent this work item back to Building. The arguments carry the reviewer's findings, the branch head they cover, and how to hand the work on when you are done. Building started as a goal the first time; this round is only the findings.

## Repository Guard

Before your first edit and again before you push, confirm you are working in the target repository named by Factory. Never edit or push anywhere else.

## Phase 1: Read the Findings

- Treat the findings as claims to verify, not instructions to obey: check each one against the code before changing anything.
- If a finding is wrong, say why in one line and leave the code alone.
- Keep the approved plan as the contract. A finding that would change the plan's scope goes back to a person, not into the code.

## Phase 2: Fix

- Address every valid finding. Do not refactor beyond what the findings need.
- Add or adjust a test for each fixed behavior, then run the narrowest tests, typecheck and lint that cover the change. An environment failure is not a pass.

## Phase 3: Push and Hand On

- Commit and push the branch.
- Hand on exactly once, as the arguments say: open the change request, or move the card back to Review for another self-review round. Never both.
- End with a short list: each finding, and whether you fixed it or why not.

## Phase 4: Transition

End the run with a single `factory_transition_work_item` call. Take the current stage and `expectedRevision` from the `factory-phase` signal.

Request `stage: "review"` (work board) with the newly created Pull request information.

The transition is governed by the server's rules. If it is rejected, read the stated reason, address it (re-check the revision from the latest `factory-phase` signal, rework the plan if the rejection contests it), and retry once corrected. Once the transition succeeds, report the plan headline and stop.

## Behavior Rules

- **One terminal call.** A single transition request ends the pass; the only permitted repeat is after a rejection, with its stated reason addressed first.
