---
'@mastra/inngest': patch
---

Fixed Inngest durable agents dropping chunks that output processors write with `writer.custom()` in `processOutputResult`. They now stream before `finish`, as with a regular `Agent`. Fixes [#29213](https://github.com/mastra-ai/mastra/issues/29213).
