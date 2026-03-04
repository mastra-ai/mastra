---
"@mastra/core": patch
---

Fix built-in workspace tools failing with `WorkspaceNotAvailableError` when the agent has a workspace configured. The workspace is now correctly passed as a fallback during tool conversion, so tools like `write_file` and `execute_command` work without requiring an execution-time workspace override.
