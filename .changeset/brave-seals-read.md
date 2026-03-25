---
'@mastra/core': minor
'@mastra/evals': minor
---

**Trajectory evaluation overhaul**: Redesigned `TrajectoryStep` as a discriminated union on `stepType` with 12 specific step types (`tool_call`, `mcp_tool_call`, `model_generation`, `agent_run`, `workflow_step`, `workflow_run`, `workflow_conditional`, `workflow_parallel`, `workflow_loop`, `workflow_sleep`, `workflow_wait_event`, `processor_run`). Each variant has type-specific properties (e.g., `toolArgs`/`toolResult` for tool calls, `status`/`output` for workflow steps).

Added hierarchical trajectory support via optional `children: TrajectoryStep[]` on all step types.

Added `TrajectoryExpectation` type for multi-dimensional trajectory expectations — supports `steps`, `ordering`, `maxSteps`, `maxTotalTokens`, `maxTotalDurationMs`, `noRedundantCalls`, `blacklistedTools`, `blacklistedSequences`, and `maxRetriesPerTool`. Used as `expectedTrajectory` on dataset items and `ScorerRun`.

Added `extractWorkflowTrajectory()` to convert workflow step results into trajectories.

Added `expectedTrajectory` flow through the `runEvals` pipeline — dataset items with `expectedTrajectory` now pass it to trajectory scorers as `run.expectedTrajectory`.

Added `trajectory` key to `WorkflowScorerConfig` for workflow trajectory scoring alongside existing `workflow` and `steps` keys.
