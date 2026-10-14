---
'@mastra/factory': patch
---

Fixed two errors that could appear when starting work in a Factory. A new session no longer shows "Failed to load messages: Thread not found" while its environment is still starting up. Starting a run on a repository that was reconnected now uses the copy that is in the Factory's environment, and if a card's repository is linked but turned off in the environment, the error names the repository and explains how to turn it back on.
