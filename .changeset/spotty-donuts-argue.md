---
'@mastra/server': patch
---

Fixed the span scores endpoint returning HTTP 500 when the scores storage domain is disabled (e.g. `domains: { scores: false }` on a composite store). The server now responds with HTTP 501 Not Implemented and a clear message, matching how the disabled observability domain is reported. Follow-up to [#20158](https://github.com/mastra-ai/mastra/pull/20158).
