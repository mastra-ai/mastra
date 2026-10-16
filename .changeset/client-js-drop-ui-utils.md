---
'@mastra/client-js': patch
---

Fixed a security alert when you install `@mastra/client-js`. The package no longer depends on `@ai-sdk/ui-utils`, which included a vulnerable version of `@ai-sdk/provider-utils`. Streaming works the same as before.
