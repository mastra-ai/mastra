---
'@mastra/core': patch
---

Added Harness v1 built-in tool compatibility for shared user prompts, plan approvals, and task workflows.

Harness tools can now update session state through a serialized request-context helper without leaking in-place state mutations between turns.
