---
'@mastra/core': patch
---

Fixed `restart()` and automatic recovery re-running a workflow step that had already finished. If the process stopped right after a step completed but before the next one started, restarting the run executed that step again, and for loops, foreach, parallel blocks, and branches that meant repeating every item, arm, or iteration. Restart now continues from the next step, and a run whose last step had already finished completes with that step's saved output instead of crashing. Agent-loop checkpoints now keep the just-finished step's conversation so the next step still receives it after a restart. Fixes [#24615](https://github.com/mastra-ai/mastra/issues/24615).

`DurableAgent.recover()` no longer hangs when the run stopped after the agent had already sent its final answer. The recovered stream now finishes with that saved answer, and `onFinish` runs once.
