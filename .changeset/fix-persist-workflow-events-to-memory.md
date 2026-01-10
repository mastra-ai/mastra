---
'@mastra/core': patch
---

fix(memory): Persist workflow step events (step-finish, tool-output) to memory for recall (#11640)

Previously, when an agent executed a workflow, the step-finish and tool-output events were streamed to the client but not persisted to memory. This caused a discrepancy where users could see detailed workflow execution during streaming, but when loading a previous thread via memory.recall(), the workflow step details were missing.

This fix adds persistence for:
- `step-finish` events → stored as `data-step-finish` parts
- `tool-output` events → stored as `data-tool-output` parts

Users can now see the same workflow execution details when loading previous threads as they saw during the original streaming session. This is especially important for HITL (Human-in-the-Loop) workflows where users need to see what approvals were requested and what decisions were made.
