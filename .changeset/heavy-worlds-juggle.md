---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed account switching and removal across running Mastra Code instances. Refresh account routing and the login manager from shared credentials, recover automatic requests whose selected account was removed, and suppress routine notices for explicitly selected accounts while preserving failover notices.
