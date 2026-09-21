---
'@mastra/core': patch
---

Fixed Harness terminal handoff recovery and fencing: a durable dispatch marker prevents provider re-execution when a dispatch outcome is ambiguous, a resumed run whose terminal settlement failed now settles from the completed run output without invoking the provider again, aborting or expiring a suspended turn cancels its deferred terminal admission, retained terminal observers are notified on abort, expiry, and session close instead of waiting forever, concurrent terminal committers share a single settlement attempt, a stale cached suspension no longer overwrites a newer pending resume, and a committed admission replays its durable receipt to duplicate stream retries.
