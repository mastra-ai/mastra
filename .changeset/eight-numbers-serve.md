---
'@mastra/inngest': patch
---

Fixed durable step failures in the Inngest dashboard and logs showing only an internal `@mastra/inngest` stack frame. The reported error now keeps the original stack, including the error type and the line that threw, while custom error properties are still preserved. Fixes [#24748](https://github.com/mastra-ai/mastra/issues/24748).
