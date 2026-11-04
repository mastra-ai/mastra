---
'@mastra/core': patch
---

Fixed evented workflows retrying failed steps immediately. They now wait `retryConfig.delay` before each retry, the same as the default engine. Fixes [#29389](https://github.com/mastra-ai/mastra/issues/29389).
