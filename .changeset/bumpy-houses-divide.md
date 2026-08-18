---
'@mastra/factory': patch
---

Improved Factory session-start robustness. Checkpoint-build failures are logged instead of swallowed, dispatcher interval options must be positive, lazy sandboxes expose the Workspace fields the rest of the stack reads, and a failing project-link callback no longer changes the HTTP response.
