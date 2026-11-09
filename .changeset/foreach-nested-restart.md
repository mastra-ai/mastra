---
'@mastra/core': patch
---

Fixed restarting a `.foreach()` over a nested workflow failing with "This workflow run was not active" when an item was running at the moment the process stopped. That item now starts over, and the restarted run finishes.
