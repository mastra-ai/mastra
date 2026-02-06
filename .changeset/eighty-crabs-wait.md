---
'@mastra/editor': patch
'@mastra/core': patch
---

Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted
