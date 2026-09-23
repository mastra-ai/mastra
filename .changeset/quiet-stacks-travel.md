---
'@mastra/inngest': patch
---

Fixed durable step errors reported to Inngest losing their original stack. The stack now starts at the frame where the step failed instead of a frame inside `@mastra/inngest`. Fixes [#24748](https://github.com/mastra-ai/mastra/issues/24748).
