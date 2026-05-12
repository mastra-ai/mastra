---
'@mastra/core': patch
'mastracode': patch
---

Fixed plan approval so accepting a plan can switch modes after the waiting plan tool resolves, clears stale abort state before starting the approved goal, and injects the goal trigger directly instead of queueing a follow-up.
