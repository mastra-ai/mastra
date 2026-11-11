---
'@mastra/factory': patch
---

Sessions in environments with several repositories now sync the other repositories side by side instead of one after another, so a session starts in roughly the time of its slowest repository rather than the sum of all of them. Setup commands still run one at a time.
