---
'@mastra/factory': patch
---

Fixed restarting a review after deleting its thread failing with "git clone failed: a branch named ... already exists". Reused Platform sandboxes now delete the previous session's local branches when they are recycled, so a new session for the same branch starts fresh from the base branch, and branch checkout recovers from leftover or broken branch refs instead of failing the workspace.
