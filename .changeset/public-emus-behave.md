---
'@mastra/core': patch
---

Fixed duplicate delegation prompts in sub-agent threads. When a supervisor agent delegated to a sub-agent without its own memory and a memory processor persisted messages during the run (such as observational memory), the delegation prompt was saved twice to the sub-agent's thread (once by the mid-run persistence and once by the delegation transcript save). The prompt now keeps a stable message ID across both writes so it is persisted exactly once. Delegation prompt rows are now stored with the default `v2` message type instead of `text`, consistent with other persisted messages.
