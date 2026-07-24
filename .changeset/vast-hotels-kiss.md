---
'@mastra/server': patch
---

Fixed observability endpoints returning HTTP 500 when the observability storage domain is disabled (e.g. `domains: { observability: false }` on a composite store). The server now responds with HTTP 501 Not Implemented and a clear message — consistent with how other capability gaps (delta polling, workspace v1) are reported — so an intentionally disabled capability is no longer reported as an internal server failure, and Studio stops polling and retrying instead of producing a continuous stream of errors. Fixes [#20157](https://github.com/mastra-ai/mastra/issues/20157).
