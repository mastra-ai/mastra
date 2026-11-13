---
'@mastra/core': patch
---

Fixed background tasks that suspend (for example a deferred tool asking a question, or an MCP task waiting for input) being lost around a shutdown or crash. A task is now stored as `suspended` only once it can actually be resumed, so a graceful shutdown no longer cancels a task that has just asked its question, and a task stored as `suspended` can be answered after a crash instead of failing with "This workflow run was not suspended". The answer reaches the tool once, including for delegated sub-agents. Fixes #30226.
