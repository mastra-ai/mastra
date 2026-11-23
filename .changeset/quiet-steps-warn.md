---
'mastra': patch
---

Fixed Studio warning that an agent "reached maxSteps" after every turn that ended on a tool call. The warning now appears only when the run actually ran out of steps. A turn that `stopWhen` ended after a question for the user, that stopped on a client tool, or that `onIterationComplete` ended no longer shows it, even on the last allowed step. Fixes [#29612](https://github.com/mastra-ai/mastra/issues/29612).
