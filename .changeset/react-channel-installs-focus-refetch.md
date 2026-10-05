---
'@mastra/react': patch
---

Fixed channel connection status staying stale after finishing an OAuth or invite flow in another tab. The installations query now refetches whenever the window regains focus, so returning to the app reflects the new connection immediately.
