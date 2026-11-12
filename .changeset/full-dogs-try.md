---
'@mastra/factory': patch
---

Reduced database reads on every agent step for work sessions started from the board. When nobody follows the work item, the Factory no longer loads the item card just to decide there is nothing to show, cutting about a third of the per-step cost for these sessions.
