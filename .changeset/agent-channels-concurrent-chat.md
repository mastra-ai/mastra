---
'@mastra/core': patch
---

`AgentChannels` now configures chat-sdk with `concurrency: { strategy: 'concurrent' }` instead of `'queue'`. Same-thread ordering, wake/deliver/queue, and run lifecycle are already handled by the agent signals layer (`ifActive`/`ifIdle`), so chat-sdk's lock-based queue was redundant. In serverless runtimes a stale lock from a frozen invocation could leave subsequent messages queued indefinitely; switching to `concurrent` removes that failure mode while keeping chat-sdk's deduplication (which runs regardless of strategy).
