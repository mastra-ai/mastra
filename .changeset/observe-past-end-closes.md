---
'@mastra/core': patch
'@mastra/server': patch
---

Resuming a finished plain (non-durable) agent run past its last chunk now closes the stream right away. Over HTTP `/observe` it used to wait for the idle timeout, and `agent.observe()` in core used to stay open until the caller detached.
