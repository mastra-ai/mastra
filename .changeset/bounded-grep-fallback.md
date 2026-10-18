---
'@mastra/core': patch
---

Fixed `workspace_grep` hanging for minutes on large workspaces. A directory search that runs on the host now has a 60-second budget. The budget covers filesystems without native grep, including the default `LocalFilesystem`, as well as the fallback used when a filesystem's native grep fails. Once the budget runs out or the agent run is aborted, the search stops starting new reads (reads already in progress finish) and returns the matches found so far. The summary line marks these results as incomplete and says how many files were scanned. The fallback log message now says why native grep failed (for example, a timeout) instead of always reporting an unsupported pattern.
