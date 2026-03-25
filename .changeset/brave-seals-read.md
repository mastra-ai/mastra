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

**Trace-based extraction:** `extractTrajectoryFromTrace()` builds hierarchical trajectories from observability trace spans. The `runEvals` pipeline automatically uses this when storage is configured, falling back to `extractTrajectory` (agents) or `extractWorkflowTrajectory` (workflows) when storage is unavailable. Trace-based extraction captures the full execution tree including nested agent runs, tool calls within workflow steps, and model generations.

**Utility functions:** `extractTrajectory`, `extractWorkflowTrajectory`, `extractTrajectoryFromTrace`, `compareTrajectories`, `checkTrajectoryEfficiency`, `checkTrajectoryBlacklist`, `analyzeToolFailures`.

**Pipeline:** `expectedTrajectory` flows from dataset items through `runEvals` to trajectory scorers. Added `trajectory` key to both `AgentScorerConfig` and `WorkflowScorerConfig`.

**Example — unified scorer with agent-level defaults:**

```ts
import { createTrajectoryScorerCode } from '@mastra/evals/scorers'

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
```

**Example — dataset items with per-item trajectory expectations:**

```ts
const datasetItems = [
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
      blacklistedTools: ['deleteAll'],
    },
  },
]
```
