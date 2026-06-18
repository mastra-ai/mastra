---
'@mastra/core': patch
---

Move the Harness's interactive tool-approval gate — and the method that responds to it — onto the Session.

When a tool requires user approval, the run parks on a promise until the UI responds. A new `SessionApproval` class (`session.approval`) owns that gate: `arm({ toolName })` returns the awaitable, `isArmed` reports whether a decision is pending, and `respond({ decision, requestContext, onAlwaysAllow })` applies the user's `approve` / `decline` / `always_allow_category` choice and releases the run. The Harness `pendingApprovalResolve` / `pendingApprovalToolName` fields are removed.

`respondToToolApproval({ decision, requestContext })` now lives on the **Session**, not the Harness. The Session composes the gate with its own grant state; the one Harness-config dependency — mapping a tool to its category for "always allow category" — is injected once via `session.setCategoryResolver()` (mirroring how the thread-settings store is injected). `Harness.respondToToolApproval()` is removed.

Consumers now call `harness.session.respondToToolApproval({ decision })`. The `pendingApproval` display-state mirror stays on the Harness.
