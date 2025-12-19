---
'@mastra/core': patch
---

Fix HITL (Human-In-The-Loop) tool execution bug when mixing tools with and without execute functions.

When an agent called multiple tools simultaneously where some had `execute` functions and others didn't (HITL tools expecting `addToolResult` from the frontend), the HITL tools would incorrectly receive `result: undefined` and be marked as "output-available" instead of "input-available". This caused the agent to continue instead of pausing for user input.
