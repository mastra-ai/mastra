---
'@mastra/factory': patch
---

Let a Factory run finish its stage when the previous role handed off in the same
session.

`factory_transition_work_item` re-checked its authority at execution time by
comparing the live run binding against the binding row that existed when the
tool was built, requiring the same row id. But handing the next role its turn in
an existing session legitimately rotates that row: the previous role's binding is
revoked and a new one is issued for the same session and the same work item.
Tools built for the earlier role stay live across that rotation, so they were
keyed to a row that the handoff itself had just replaced.

The visible result: planning produced a complete plan, called its terminal
transition to `execute`, and was refused with "Factory agent binding is
unavailable, revoked, or no longer matches this session." The item stopped in
Planning with the plan written but never advanced, and the decision that carried
it reported success. Every leg that continues an item in an existing session —
planning after triage, and the review-feedback wakes — failed the same way.

Authority is now the work item the session is bound to rather than the
individual binding row, so a rotation no longer strands the run it exists to
start. Re-pointing a session at a *different* work item is still refused.
