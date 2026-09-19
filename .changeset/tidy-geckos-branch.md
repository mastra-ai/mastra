---
'@mastra/core': minor
---

Added shared-history thread branching to the agent controller session API. `SessionThread.branch()` forks the current thread at a chosen message into a shared-history child thread and rebinds the session to it, and new `getParent()`, `listBranches()`, and `getBranchInfo()` accessors expose branch lineage to controller hosts. Branching requires a configured `Memory` with branch support; hosts on raw storage or non-branching custom memory get graceful empty lineage reads and a `BRANCHING_UNSUPPORTED` error on branch creation.
