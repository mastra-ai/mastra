---
'@mastra/docker': patch
---

Fixed process kill to target the entire process group (negative PID) with fallback, ensuring child processes spawned inside the container are properly cleaned up. Tracked process handles are now cleared after container stop or destroy to prevent stale references.
