---
'@mastra/core': patch
---

Enforce resource ownership on Harness session thread operations. `SessionThread.switch`, `delete`, `listMessages`, and `clone` now verify the target thread belongs to the session's `resourceId` before acting, treating threads owned by another resource as not found. This prevents a session (e.g. an authenticated HTTP caller scoped to one `resourceId`) from reading, switching to, renaming, deleting, or cloning a thread owned by a different resource via an arbitrary `threadId`.
