---
'@mastra/core': patch
---

Fixed workflow snapshot records leaking in storage for every agent run. Completed agent runs left behind stale "pending" or "suspended" records indefinitely. These internal records are now removed when an agent run finishes, fails, or is declined. A "suspended" status in workflow snapshot storage now reliably means the run is actually resumable.
