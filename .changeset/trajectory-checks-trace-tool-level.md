---
'@mastra/evals': patch
---

Fixed trajectory scorers giving wrong results on trajectories built from traces. Traces wrap tool calls in `model_generation` steps and put `processor_run` steps around them, so a correct run scored 0 for accuracy, `maxSteps` counted wrapper steps, and forbidden sequences and tool retries were missed. All trajectory checks (`compareTrajectories`, `checkTrajectoryEfficiency`, `checkTrajectoryBlacklist`, `analyzeToolFailures`, the code trajectory scorers, and the LLM trajectory judge) now read tool calls the same way for trace and message trajectories, so a run gets the same score either way.

Token budgets still read `model_generation` steps, and expectations that name `model_generation` or `processor_run` steps are still compared against the raw trajectory. `maxSteps` and the `index` in `redundantCalls` now count tool-level steps on trace trajectories.

The new `toToolLevelSteps` helper returns this tool-level view if you need it in a custom scorer.

```ts
import { toToolLevelSteps } from '@mastra/evals/scorers/utils';

const toolNames = toToolLevelSteps(trajectory.steps).map(step => step.name);
```

Retries are now grouped across `model_generation` steps of the same run, as they are on message trajectories. Tool calls in separate sub-agent runs are still counted separately.
