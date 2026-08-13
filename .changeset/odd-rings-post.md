---
'@mastra/core': patch
---

Fixed nested workflow suspend reporting so getWorkflowRunById exposes a single suspended leaf step instead of duplicating the parent container, and cleared stale suspendPayload/suspendedAt after a step re-enters or completes.

Closes #21229
