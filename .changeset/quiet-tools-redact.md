---
'@mastra/core': patch
'@mastra/mcp': patch
---

Tool validation failures no longer write submitted values to logs. When a tool rejects its input, output, suspend data, or resume data, the log entry now records only the tool and the failing field paths (for example `issuePaths: ["email"]`) instead of the full validation message, which echoed back what was submitted. The error returned to the model or MCP caller is unchanged, so it can still correct its call. MCP execution failures also stop attaching the submitted arguments to tracked exceptions. Fixes #29318.
