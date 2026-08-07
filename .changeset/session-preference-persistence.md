---
'@mastra/core': patch
---

Fixed AgentController session preferences (thinking level, notifications) reverting to defaults after a server restart. These preferences now survive restarts and follow the conversation: reopening a thread restores the values that were active in it, including on self-hosted Factory deployments.
