---
'@mastra/core': patch
---

Fixed Harness terminal handoff recovery and fencing.

- A durable dispatch marker prevents provider re-execution when a dispatch outcome is ambiguous.
- A resumed run whose terminal settlement failed now settles from the completed run output without invoking the provider again.
- Aborting or expiring a suspended turn cancels its deferred terminal admission.
- Retained terminal observers are notified on abort, expiry, and session close instead of waiting forever.
- Concurrent terminal committers share a single settlement attempt.
- A stale cached suspension no longer overwrites a newer pending resume.
- A committed admission replays its durable receipt to duplicate stream retries.
