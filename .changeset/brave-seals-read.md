---
'@mastra/core': minor
'@mastra/evals': minor
---

**Trajectory evaluation**: Added trajectory scoring for evaluating agent tool call sequences and workflow execution paths.

`TrajectoryStep` is a discriminated union on `stepType` with 12 specific step types (`tool_call`, `mcp_tool_call`, `model_generation`, `agent_run`, `workflow_step`, `workflow_run`, `workflow_conditional`, `workflow_parallel`, `workflow_loop`, `workflow_sleep`, `workflow_wait_event`, `processor_run`). Each variant has type-specific properties (e.g., `toolArgs`/`toolResult` for tool calls, `status`/`output` for workflow steps). Supports hierarchical trajectories via optional `children`.

`TrajectoryExpectation` type for multi-dimensional trajectory expectations — supports `steps`, `ordering`, `maxSteps`, `maxTotalTokens`, `maxTotalDurationMs`, `noRedundantCalls`, `blacklistedTools`, `blacklistedSequences`, and `maxRetriesPerTool`.

**Scorers:**

- `createTrajectoryScorerCode` — unified multi-dimensional scorer evaluating accuracy, efficiency, blacklist violations, and tool failure patterns in a single pass. Supports per-item `TrajectoryExpectation` from datasets with static defaults.
- `createTrajectoryAccuracyScorerCode` — deterministic code-based accuracy scorer with strict/relaxed/unordered ordering modes.
- `createTrajectoryAccuracyScorerLLM` — LLM-based scorer for semantic trajectory evaluation.

**Utility functions:** `extractTrajectory`, `extractWorkflowTrajectory`, `compareTrajectories`, `checkTrajectoryEfficiency`, `checkTrajectoryBlacklist`, `analyzeToolFailures`.

**Pipeline:** `expectedTrajectory` flows from dataset items through `runEvals` to trajectory scorers. Added `trajectory` key to both `AgentScorerConfig` and `WorkflowScorerConfig`.

**Example — scoring an agent with static defaults:**

```ts
import { createTrajectoryScorerCode } from '@mastra/evals/scorers'
import { runEvals } from '@mastra/core/evals'

const scorer = createTrajectoryScorerCode({
  defaults: {
    steps: [
      { stepType: 'tool_call', name: 'search' },
      { stepType: 'tool_call', name: 'summarize' },
    ],
    maxSteps: 5,
    noRedundantCalls: true,
    blacklistedTools: ['deleteAll'],
  },
})

const result = await runEvals({
  target: myAgent,
  scorers: { trajectory: [scorer] },
  data: [{ input: 'Search and summarize the weather' }],
})
```

**Example — per-item expectations from a dataset:**

```ts
const scorer = createTrajectoryScorerCode({
  defaults: {
    blacklistedTools: ['deleteAll'],
    maxSteps: 10,
  },
})

const result = await runEvals({
  target: myAgent,
  scorers: { trajectory: [scorer] },
  data: [
    {
      input: 'Search for weather',
      expectedTrajectory: {
        steps: [{ stepType: 'tool_call', name: 'search' }],
        maxSteps: 2,
      },
    },
    {
      input: 'Search and summarize weather',
      expectedTrajectory: {
        steps: [
          { stepType: 'tool_call', name: 'search' },
          { stepType: 'tool_call', name: 'summarize' },
        ],
      },
    },
  ],
})
```
