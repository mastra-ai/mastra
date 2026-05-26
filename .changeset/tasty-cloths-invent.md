---
'@mastra/playground-ui': patch
---

Improved `@mastra/playground-ui` stability by removing legacy runtime UI dependencies without changing `SideDialog`, `MainSidebar`, or accessibility behavior. Nested `SideDialog` levels now stack consistently, so multi-level flows behave predictably.
