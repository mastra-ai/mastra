---
'@mastra/playground-ui': patch
---

Tool call rows for `execute_command` now show the command's `description` on its own when the agent provides one, for example `Finding the processor wiring` instead of `Run` followed by a long `rg` pipeline. Expanding the row still shows the full command. Calls without a description are unchanged. `presentTool` returns it as a new `description` field, and `ToolCallPresentedHeader` accepts a matching `description` prop.
