---
'@mastra/factory': patch
---

The stock Factory planning handoff no longer bypasses the human plan checkpoint when Auto-approve plans is off. `FactoryTransitionService` now resolves whether plans are auto-approved (via `plansPreapprovedAt` or the project's `autoApprovePlans` setting, mirroring the dispatcher) and exposes it to the board transition policy. The Work board policy rejects a plan agent's `planning → execute` transition with `approval_required` when plans are not auto-approved and the move is not human-initiated, so no build is queued until a human approves the plan or `autoApprovePlans` is enabled. Arming an autonomous run no longer counts as plan approval on its own. Fixes #23742.
