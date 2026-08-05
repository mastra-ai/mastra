---
'@mastra/core': patch
---

Fixed sessions creating a new empty thread instead of resuming their conversation. Thread selection filtered threads by the controller-wide `projectPath` while thread creation stamped the session's own, so on hosts where a dynamic workspace gives each session its own working directory the two never matched and every session start left an orphaned thread behind. Selection now reads the scope from the session itself, and a thread carrying no scope stays resumable instead of being skipped.
