---
'@mastra/core': patch
---

Fixed tool approval failing on runs with large workflow snapshots. `agent.approveToolCall()`, `declineToolCall()`, and `resumeStream({ toolCallId })` could throw `AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED` for a run that was genuinely suspended. This happened when saving a large snapshot took longer than the fixed 2-second validation window. The validator now waits while the run is still persisting its suspension, and rejects right away when the tool call is stale or the run has already finished. Fixes #22413.
