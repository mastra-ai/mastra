---
'@mastra/core': patch
---

Fixed destroyed workspaces holding on to their indexed documents and loaded skills. Long-running apps that create a workspace per session no longer grow in memory as sessions come and go.

**Also in this change**

- Cleanup now runs even when another part of the workspace fails to shut down.
- Indexing or accessing skills after workspace teardown begins now throws `WorkspaceNotReadyError` instead of quietly repopulating released content.
