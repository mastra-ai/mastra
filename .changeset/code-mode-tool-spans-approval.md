---
'@mastra/core': patch
---

Fixed Code Mode tracing and approvals. Each tool that a Code Mode program calls now gets its own tool call span, with its input, output and errors. A tool that needs approval (`requireApproval`) is now refused instead of running without approval, so give such tools to the agent as direct tools.
