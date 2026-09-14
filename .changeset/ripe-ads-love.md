---
'@mastra/playground-ui': patch
---

Fixed keyboard shortcuts so rejected scoped sequences do not block other shortcuts, disabled or unmounted shortcuts cannot resume pending sequences, and consumed or composing events do not trigger global actions. Disabled list search shortcuts no longer intercept the active search field's shortcut.
