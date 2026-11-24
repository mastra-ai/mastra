---
'@mastra/playground-ui': patch
'@mastra/factory': patch
'@mastra/platform': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Added `useKnowledgeChangeFeed` and `knowledgePollInterval` for Knowledge pages that follow a change stream. A burst of change notices now starts one refresh, refreshes never overlap, and they start at least five seconds apart, so an agent writing continuously no longer stacks graph reads on the server.
