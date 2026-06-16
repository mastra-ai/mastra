---
'@mastra/core': patch
---

Make `AgentChannels` chat platforms work end-to-end on serverless runtimes (Vercel, AWS Lambda, etc.).

**Await the agent run when waking a new run.** Previously `processChatMessage` fired `agent.sendMessage(...)` and returned immediately, relying on a side-effect subscription to drive the stream. That works in long-lived Node processes but breaks on serverless where the function exits as soon as it returns and kills the run mid-flight. The handler now awaits `result.accepted`; when it resolves to `{ action: 'wake', output }` (this invocation woke and owns the run), it awaits `output.consumeStream()` before returning. Any other action (`deliver`/`persist`/`discard`) means the signal was handed off — another invocation owns the run — so consumption is skipped.

**Render via a per-run output processor instead of a background subscription.** New `ChatChannelOutputProcessor` (contributed via `AgentChannels.getOutputProcessors()`) pumps chunks through the existing streaming/static chat drivers using an async queue, keyed to the run's `RequestContext`. `Agent#listResolvedOutputProcessors` now collects channel output processors (mirroring the input processor hookup) so they actually run during stream consumption. The duplicate background subscription consumer is removed from `processChatMessage` — only the winning invocation renders, so multi-Lambda races no longer post duplicate replies. Slash-command and resume paths still use the subscription consumer.

**Render every step of multi-step runs.** Agents emit a `finish` chunk per LLM step, not per run. The output processor now keeps the render session open when `finish.stepResult.isContinued === true`, so multi-step runs render every step's text instead of dropping all but the first.

**Switch chat-sdk to `concurrency: { strategy: 'concurrent' }`.** Same-thread ordering, wake/deliver/queue, and run lifecycle are already handled by the agent signals layer (`ifActive`/`ifIdle`), so chat-sdk's lock-based queue was redundant. In serverless runtimes a stale lock from a frozen invocation could leave subsequent messages queued indefinitely; `concurrent` removes that failure mode while keeping chat-sdk's deduplication (which runs regardless of strategy).
