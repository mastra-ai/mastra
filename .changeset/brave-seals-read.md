---
'@mastra/core': minor
---

**Trajectory evaluation**: Added trajectory types and trace-based extraction for evaluating agent and workflow execution paths.

`TrajectoryStep` models each step in an execution as a typed object — tool calls, model generations, agent runs, workflow steps, and control flow nodes each have their own variant with relevant properties (e.g., `toolArgs`/`toolResult` for tool calls, `modelId`/`promptTokens` for model generations). Steps can be nested via `children` to represent hierarchical execution.

`TrajectoryExpectation` lets you define what a good trajectory looks like — expected steps, ordering, step/token/duration budgets, blacklisted tools, and retry thresholds.

**Trace-based extraction:** `extractTrajectoryFromTrace()` builds hierarchical trajectories from observability trace spans. The `runEvals` pipeline automatically uses this when storage is configured, capturing the full execution tree including nested agent runs and tool calls. Falls back to `extractTrajectory` (agents) or `extractWorkflowTrajectory` (workflows) when storage is unavailable.

**Pipeline:** `expectedTrajectory` flows from dataset items through `runEvals` to trajectory scorers. Added `trajectory` key to both `AgentScorerConfig` and `WorkflowScorerConfig`.
