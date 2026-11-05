---
'@mastra/inngest': patch
---

Fixed tool approvals on Inngest agents running a tool more than once, or running a tool nobody approved.

- Approving the same tool call twice now fails the second approval with `AGENT_RESUME_ALREADY_CLAIMED` instead of running the tool again ([#27485](https://github.com/mastra-ai/mastra/issues/27485)). Across processes this needs storage that supports both concurrent workflow-state updates and run fencing (`supportsConcurrentUpdates()` and `supportsRunFencing()`). Without both it holds within one process.
- When several tool calls wait for approval, approving one now runs only that tool. Approving the rest in any order runs each tool once and delivers the final answer once ([#27925](https://github.com/mastra-ai/mastra/issues/27925)). An approval of another call that arrives while a resumed run is still going waits up to 10 seconds for it to pause again.
- `approveToolCall()`, `declineToolCall()`, `resumeStream()` and `resumeGenerate()` on one of several waiting tool calls now end their stream when the run waits on the others again.
- When Inngest fails or cancels a resumed run, the run now ends as failed or canceled and its stream ends with an error or abort. A tool that was already running still finishes.
- If the process sending an approval dies before Inngest receives it, approving again works after 60 seconds. Until then, approvals fail with `AGENT_RESUME_ALREADY_CLAIMED`.

`serve()` and `connect()` now register one more Inngest function per app, `workflow.inngest:durable-agentic-loop.resume-claim-release`, which counts toward your Inngest function limit. Sync your app after upgrading. Until it is synced, a resumed run that Inngest fails or cancels cannot be approved or resumed for 24 hours.
