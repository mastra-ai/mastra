---
'@mastra/evals': minor
---

**Trajectory scorers**: Added scorers for evaluating agent and workflow execution paths.

- `createTrajectoryScorerCode` — unified scorer that evaluates accuracy, efficiency, blacklist violations, and tool failure patterns in a single pass. Supports per-item expectations from datasets with static defaults. Nested `ExpectedStep.children` configs allow recursive evaluation with different rules per hierarchy level.
- `createTrajectoryAccuracyScorerCode` — deterministic accuracy scorer with strict, relaxed, and unordered ordering modes.
- `createTrajectoryAccuracyScorerLLM` — LLM-based scorer for semantic trajectory evaluation.

**Utility functions:**

- `extractTrajectory` / `extractWorkflowTrajectory` — Convert agent runs and workflow executions into structured trajectories
- `extractTrajectoryFromTrace` — Build hierarchical trajectories from observability trace spans, including nested agent/tool calls
- `compareTrajectories` — Compare actual vs. expected trajectories with configurable ordering and data matching. Accepts `ExpectedStep[]` for simpler expected step definitions
- `checkTrajectoryEfficiency` — Evaluate step counts, token usage, and duration against budgets
- `checkTrajectoryBlacklist` — Detect forbidden tools or tool sequences
- `analyzeToolFailures` — Detect retry patterns, fallbacks, and argument corrections

**Example — unified scorer with defaults:**

```ts
import { createTrajectoryScorerCode } from '@mastra/evals/scorers'

const scorer = createTrajectoryScorerCode({
  defaults: {
    ordering: 'strict',
    steps: [
      { name: 'validate-input' },
      {
        name: 'research-agent',
        stepType: 'agent_run',
        children: {
          ordering: 'unordered',
          steps: [{ name: 'search' }, { name: 'summarize' }],
        },
      },
      { name: 'save-result' },
    ],
    maxSteps: 10,
    blacklistedTools: ['deleteAll'],
  },
})
```
