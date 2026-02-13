---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage.
