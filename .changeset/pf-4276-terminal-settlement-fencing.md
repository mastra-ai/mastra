---
'@mastra/core': patch
---

Fixed terminal handoff settlement races in Harness v1 sessions.

- A resumed turn that joins an in-flight commit now completes settlement instead of leaving the admission pending forever.
- A suspended caller whose commit attempt was cancelled now receives the cancellation instead of waiting forever.
- A storage failure while recovering a suspended run now reports the failure to your terminal callbacks instead of leaving them silent.
- Cancelling a response that another writer already sealed now reports the sealed result to waiting callers instead of a cancellation that never happened.
- A response that cannot be re-suspended now cancels its grant instead of leaving it pending with nothing able to settle it.
- A stale settlement retry can no longer overwrite a newer `switchMode` or resurrect a cleared pending interaction.
- Reopening a session no longer counts token usage that a suspended run already recorded.
- Approving a plan now applies the target mode even when the approval call crashed part way through.
- Goal judging runs once per settled run.
