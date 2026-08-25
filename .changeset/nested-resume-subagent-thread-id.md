---
'@mastra/core': patch
---

Fix delegated sub-agent `writer.custom()` frames being dropped after a suspend/resume.

When a `requireApproval` tool runs inside a delegated sub-agent (built-in supervisor `agents: {}`), suspends, and the run is resumed via `agent.resumeStream()`, the sub-agent tool's `context.writer.custom()` frames were silently dropped from the parent stream. The initial (non-resumed) delegated run and non-delegated resumes were unaffected.

Root cause: the agent-as-tool wrapper derived the sub-agent thread id as `` `${inputData.threadId}-${randomUUID()}` ``. The wrapper's `execute` re-runs top-down on resume, so `randomUUID()` regenerated a different suffix than the initial pass. The resumed sub-agent's persisted `MessageList` thread id then no longer matched, and `writer.custom()` threw `MessageList`'s "wrong threadId" guard (`inputToMastraDBMessage`), dropping the frame.

Fix: derive the sub-agent thread id deterministically from the stable `toolCallId` (`` `${inputData.threadId}-${toolCallId}` ``), which is stable across resume and unique per delegation.

See #22281
