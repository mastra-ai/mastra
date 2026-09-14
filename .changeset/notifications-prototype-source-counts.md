---
'@mastra/core': patch
---

`summarizeNotifications()` now counts notification sources whose names collide with `Object.prototype` members (for example `__proto__`, `constructor`, `toString`) as ordinary own numeric properties. The per-source and per-priority accumulators are seeded with null-prototype objects, so a `__proto__` source is no longer silently dropped from the summary and `constructor`/`toString` sources no longer produce non-numeric string counts. Fixes #23693.
