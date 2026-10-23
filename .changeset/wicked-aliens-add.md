---
'@mastra/playground-ui': patch
---

With a hidden sidebar (`collapsedWidth={0}` and collapsed), `AppShell` and `MainCard` now run the page edge to edge instead of framing it in an inset card. The frame comes back, animated, when the sidebar opens. `useSidebar()` also returns `isHidden` for layouts that need the same signal.
