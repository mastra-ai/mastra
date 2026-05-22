---
'mastracode': patch
---

Replaced remaining synchronous event-loop blockers with async alternatives: getDynamicInstructions now uses async git branch detection and parallel binary resolution, and SystemReminderComponent reads files asynchronously to avoid blocking during streaming.
