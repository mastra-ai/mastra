---
'@mastra/factory': patch
---

Added older-commit paging to the repository commits route (`from` and `page`) and an `actors=none` option to the audit route. The Activity page uses them to load commits further back in time and to poll agent runs without looking up user profiles on every request.
