---
'@mastra/core': patch
---

Fixed calls on the original `durable: true` Agent instance to use the registered durable wrapper after Mastra registration, including suspend and resume. Fixes [#28189](https://github.com/mastra-ai/mastra/issues/28189).
