---
'@mastra/core': minor
---

Added logger support to Workspace filesystem and sandbox providers. Providers extending MastraFilesystem or MastraSandbox now automatically receive the Mastra logger for consistent logging of file operations and command executions.
