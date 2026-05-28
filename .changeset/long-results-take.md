---
'@mastra/core': patch
---

Fixed AGENT_RUN spans not closing when an agent stream is aborted mid-flight (e.g. browser disconnect or `AbortController.abort()`). Aborted runs now end with `{ status: 'aborted', reason: 'abort' }` so traces are exported to observability backends.
