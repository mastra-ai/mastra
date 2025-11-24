---
'@mastra/playground-ui': patch
'@mastra/react': patch
'@mastra/core': patch
---

fix(agent): persist messages before tool suspension

Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

**Backend changes (@mastra/core):**
- Add assistant messages to messageList immediately after LLM execution
- Flush messages synchronously before suspension to persist state
- Create thread if it doesn't exist before flushing
- Add metadata helpers to persist and remove tool approval state
- Pass saveQueueManager and memory context through workflow for immediate persistence

**Frontend changes (@mastra/react):**
- Extract runId from pending approvals to enable resumption after refresh
- Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
- Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
- Change runId from hardcoded `agentId` to unique `uuid()`

**UI changes (@mastra/playground-ui):**
- Handle tool calls awaiting approval in message initialization
- Convert approval metadata format when loading initial messages

Fixes #9745, #9906