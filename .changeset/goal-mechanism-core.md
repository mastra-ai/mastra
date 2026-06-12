---
'@mastra/core': minor
---

Add a native **goal** mechanism to the `Agent` — a durable, thread-scoped objective that is judged in-loop and gates the agentic execution loop, mirroring the `isTaskComplete` step.

Previously a "goal / Ralph loop" had to be built on top of the agent by re-invoking `agent.stream()` between full turns and running a hand-rolled judge agent. That approach was consumer-specific and could not evaluate an objective mid-run (e.g. when a `sendMessage` signal was delivered into an already-running loop). Goals are now an Agent capability.

A new `goal` config is accepted on the `Agent`:

```ts
import { Agent } from '@mastra/core/agent';
import { GoalSignalProvider } from '@mastra/core/signals';

const agent = new Agent({
  name,
  instructions,
  model,
  memory,
  goal: { judge: '__GATEWAY_OPENAI_MODEL__', maxRuns: 50 /* prompt? */ },
});
```

The objective lives in the generic `threadState` storage domain under `type: "goal"` (reusing the domain introduced for task tools), so it persists across process restarts and is serializable mid-run. Programmatic control is via new `Agent` methods: `setObjective(objective, { threadId, resourceId?, judgeModelId?, maxRuns?, prompt? })`, `getObjective({ threadId })`, `clearObjective({ threadId })`, and `updateObjectiveOptions({ threadId, judgeModelId?, maxRuns?, prompt? })`. All no-op when the run is not memory-backed.

Behavior:

- A new **goal step** runs after `isTaskCompleteStep` in the agentic execution workflow, using the same gating as `isTaskComplete` (skips background-task / mid-tool-loop / working-memory-only iterations). On a candidate answer it scores the objective with an LLM-as-judge (`createRubricScorer`, dynamic rubric = the objective), persists `runsUsed`, and gates the loop: pass → `status: "done"`, `isContinued = false`; not passed within budget → `isContinued = true` (the goal gate wins over `isTaskComplete`); `runsUsed >= maxRuns` → stop and keep `status: "active"`.
- **The judge model is required.** Settings resolve per evaluation as ThreadState record value → agent `goal` config → default (`maxRuns` `50`, a default judge prompt). If no judge model resolves from either the record or `goal.judge`, the goal step is a complete no-op: no scoring, no `runsUsed` increment, and no `goal` chunk.
- **`goal.judge` accepts a resolver function.** In addition to a model id or model object, `goal.judge` may be a `({ requestContext, mastra }) => model | undefined` function so a consumer can inject provider credentials and read the current judge selection at runtime (returning `undefined` keeps the step a no-op). A bare model id (from `goal.judge` or the per-objective `judgeModelId`) is resolved through the Mastra instance's model router/gateways when the default scorer is built, so provider credentials are applied rather than falling back to the default provider path.
- The current objective is projected onto the agent **state-signal** lane (`<current-objective>`) by the new `GoalStateProcessor`, so the model sees it in context without invalidating the prompt-cache prefix.
- A typed **`goal`** stream chunk is emitted on every evaluation (`GoalEvaluationPayload`: objective, iteration, maxRuns, passed, status, results, reason?, duration, timedOut, maxRunsReached, suppressFeedback) for consumers (TUI / `@mastra/client-js`).

For the simplest setup, register `GoalSignalProvider` via the agent's `signals` array — when `goal` config is present the Agent also auto-registers `GoalStateProcessor` if no goal provider is supplied.

The goal primitives are co-located under `agent/goal` (objective store, scorer, state processor, signal provider). The public export surface is unchanged: `@mastra/core/tools` re-exports `GoalStateProcessor`, `DEFAULT_GOAL_JUDGE_PROMPT`, `DEFAULT_GOAL_MAX_RUNS`, and the goal helpers/types (`AgentGoalConfigDefaults`, etc.); `@mastra/core/signals` re-exports `GoalSignalProvider`; `@mastra/core/stream` exports `GoalEvaluationPayload`. New type on the thread-state domain: `GoalObjectiveRecord`. The `goal` arm is added to the public `ChunkType` union. No breaking change to `isTaskComplete`.
