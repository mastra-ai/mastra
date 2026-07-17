---
'@mastra/core': patch
---

Fixed resuming delegated tool approvals after a page refresh or server restart. When a supervisor agent delegated to a sub-agent whose tool required approval, the approval saved in the conversation carried the sub-agent's internal run id instead of the supervisor's resumable run id. Resuming with the saved pair then failed with AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED and apps had to look the run up again via listSuspendedRuns as a workaround. The saved runId now always points to the supervisor run accepted by resumeStream() and approveToolCall(), while the sub-agent's run is kept separately as delegatedRunId so delegated tools still resume their own suspended work. Approvals saved before this fix keep working.
