---
'@mastra/core': patch
---

Fixed durable agents giving delegated sub-agents a shared, parent-derived memory scope instead of one derived from the calling user. The durable execution path now stamps the caller's thread and resource identity onto delegated agent-tool calls, matching the regular agent loop, so each user's sub-agent conversations stay isolated and memory continuity works across turns. Fixes [#23903](https://github.com/mastra-ai/mastra/issues/23903).
