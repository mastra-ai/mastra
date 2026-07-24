---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Fixed Studio repeatedly polling observability endpoints when the observability storage domain is disabled. Studio now treats the disabled domain as an unavailable capability: score and log views stop polling, failed requests are not retried, and the Logs page shows a clear unavailable state instead of a generic error. Related to [#20157](https://github.com/mastra-ai/mastra/issues/20157).
