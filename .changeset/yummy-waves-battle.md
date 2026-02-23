---
'@mastra/playground-ui': patch
---

Fixed publish button in agent CMS to be disabled when no draft exists, preventing unnecessary error toasts. Also fixed stale agent data after saving a draft or publishing by invalidating the agent query cache. Fixed tool count in the CMS sidebar and tools page to correctly include integration tools.
