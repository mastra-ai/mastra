---
'@mastra/core': patch
---

Fixed evented workflows and evented agents storing the caller's auth token (`mastra__authToken`) in workflow snapshots. The token is now stripped before every snapshot write, matching the default workflow engine; steps still receive the live token while the run executes, and resumed runs use the token from the resuming request instead of any token left in older snapshots. Fixes #26217.
