---
'@mastra/core': patch
---

Improved workflow recovery so it lists active runs for at most five workflows at a time instead of all at once. A recovery scan no longer takes every connection of the storage pool and slows down the process's other storage calls.
