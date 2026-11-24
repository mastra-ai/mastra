---
'@mastra/playground-ui': patch
---

Added `useKnowledgeChangeFeed` and `knowledgePollInterval` for Knowledge pages that follow a change stream. A burst of change notices now starts one refresh, refreshes never overlap, and each starts at least five seconds after the previous one ended. A refresh joins a read already running, such as a poll, instead of restarting it beside the first, so an agent writing continuously no longer stacks reads on the server.
