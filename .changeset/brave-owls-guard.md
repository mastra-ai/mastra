---
'@mastra/server': patch
---

Fixed tool approval and resume routes so agents that run on a durable or evented execution engine (`durable.executionEngine`) get the same run ownership checks as `createDurableAgent()` agents. Requests can no longer resume or approve a suspended run that belongs to another resource or thread.
