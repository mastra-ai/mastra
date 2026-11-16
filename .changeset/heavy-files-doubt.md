---
'@mastra/core': patch
---

Thread subscription copies of an agent's `finish` chunk now include `output.stepCount`, the number of steps that count against `maxSteps`. These copies leave out `output.steps` to stay small, so subscribers had no way to tell whether a run used its whole step budget. Processor retry steps are not counted, matching how `maxSteps` is enforced. Fixes [#29612](https://github.com/mastra-ai/mastra/issues/29612).
