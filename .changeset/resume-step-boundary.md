---
'@mastra/core': patch
---

Fixed agent snapshots growing quadratically across chains of approved tool calls. After `approveToolCall`, `declineToolCall`, or `resumeStream`, each saved step now holds only its own content, so snapshots grow linearly and processors and `prepareStep` see the correct content for resumed steps. Fixes #26475.
