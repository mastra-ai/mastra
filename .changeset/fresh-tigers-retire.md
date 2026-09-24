---
'@mastra/core': patch
---

Added yield-on-demand to cross-process thread ownership. `agent.claimThreadOwnership()` accepts a `yieldOwnership` callback; when another process asks to claim the thread (owner discovery requests now carry `intent: "claim"`), the owner may return `true` to release its claim so the requester wins on its next attempt. Added the `thread_ownership_changed` controller event so sessions can report when another process holds a thread they loaded.
