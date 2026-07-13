---
'@mastra/code-sdk': patch
---

Teach the `mastracode` workflow-builder sub-agent the full static step subset.

**What changed**

- `workflowBuilderAgent`'s instructions now document `parallel`, `foreach`, static `sleep`, and static `sleepUntil` alongside the existing `agent` / `tool` / `mapping` step types, including their exact JSON shapes and the rule that `foreach` inputs must be arrays.
- The `save-workflow` tool's `graph` field description now enumerates every emittable discriminant so the LLM sees the full static subset when it constructs a workflow definition.
- Adds an explicit "out of scope" note to the sub-agent covering `conditional`, `loop` (`dowhile` / `dountil`), and dynamic `sleep(fn)` / `sleepUntil(fn)` variants — these still need the Phase-2 predicate DSL.

**Why**

The workflow engine already round-trips `parallel`, `foreach`, and static sleep entries through `toStorableGraph` / `rehydrateWorkflow`, but the builder sub-agent was only ever taught about `agent` / `tool` / `mapping`. That left users unable to construct fan-out, iteration, or wait steps from the chat surface even though the runtime supported them.
