---
'@mastra/core': patch
---

Fixed `workspace_grep` hanging for minutes on large remote workspaces when the filesystem's native grep fails. The host-side fallback search now stops after 60 seconds, or as soon as the agent run is aborted, and returns the matches found so far. The summary line marks these results as incomplete. The fallback log message now says why native grep failed (for example, a timeout) instead of always reporting an unsupported pattern.
