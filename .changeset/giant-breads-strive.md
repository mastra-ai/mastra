---
'@mastra/factory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Fixed Factory sessions failing to start their kickoff run. Workspaces now recover automatically when the sandbox provider changes or a sandbox is wiped (the repository is re-cloned instead of failing), thread pages surface workspace preparation errors with a Retry button instead of hanging, and kickoff messages are now delivered to the session thread instead of silently failing with a permissions error.
