---
'@mastra/factory': patch
---

Fixed restarting a review after deleting its thread. It no longer fails with "git clone failed: a branch named ... already exists". Reused Platform sandboxes now delete the previous session's local branches when they are recycled. A new session for the same branch starts fresh from the base branch. Branch checkout also recovers from leftover or broken branch refs instead of failing the workspace.
