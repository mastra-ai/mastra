---
'@mastra/core': patch
---

Fixed Harness v1 force-delete recovery so live session handles are marked deleted when a custom batch delete adapter removes part of a closed subtree before rejecting.
