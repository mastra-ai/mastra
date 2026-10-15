---
'@mastra/core': patch
---

Fixed agents sending the same request until `maxSteps` when a text-only response ended with a non-standard finish reason, such as `other`. The run now ends after that response, so the text and token usage are no longer repeated.
