---
'mastra': patch
---

Fixed `mastra api` commands exiting with code 1 after a successful request when the output was piped to a command that exits early, such as `mastra api tool execute ... | head`. The exit code now reflects whether the request succeeded, so scripts and agents no longer treat successful calls as failures.
