---
'mastra': patch
---

Fixed Studio warning that an agent "reached maxSteps" after every turn that ended on a tool call. The warning now appears only when the run used every step in its `maxSteps` budget, so a turn that `stopWhen` ended after one tool call, such as a question for the user, no longer shows it. Fixes [#29612](https://github.com/mastra-ai/mastra/issues/29612).
