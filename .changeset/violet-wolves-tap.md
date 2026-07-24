---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Fixed the trace feedback panel continuing to poll every 3 seconds when the observability storage domain is disabled. Studio now also recognizes the "Scores storage domain is not available" response from the span scores endpoint, so span score polling stops for disabled scores storage as well. Follow-up to [#20158](https://github.com/mastra-ai/mastra/pull/20158).
