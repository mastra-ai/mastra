---
'@mastra/core': patch
---

Fixed two cases where an AgentController tool approval could get out of sync with its stored run:

- **A failed resume no longer loses the answer.** If approving or declining a tool call fails while the run is still waiting on it, the approval prompt is raised again (`tool_approval_required`) so the answer can be retried. Previously a retry returned `{ accepted: false, reason: 'not_pending' }` and the run stayed suspended.
- **Detaching no longer declines a pending approval.** `session.thread.detachFromCurrent()` now leaves a parked tool approval pending in storage, as documented, instead of declining it. It can be answered later, for example with `respondToPersistedToolApproval`.
