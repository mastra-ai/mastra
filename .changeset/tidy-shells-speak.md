---
'@mastra/playground-ui': patch
---

Tool call rows for `execute_command` now show the command's `description` in place of the command when the agent provides one, for example `Run  Finding the processor wiring` instead of a long `rg` pipeline. Expanding the row still shows the full command. Calls without a description are unchanged.
