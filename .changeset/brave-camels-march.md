---
'@mastra/core': patch
---

Fixed signals that wake an idle thread so they continue through durable execution when the agent is wrapped by a durable integration such as `@mastra/inngest`, instead of falling back to the wrapped agent's in-process run. Fixes [#23800](https://github.com/mastra-ai/mastra/issues/23800).
