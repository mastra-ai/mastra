---
'@mastra/core': minor
---

Added multi-turn support to `runEvals`. Data items can now include an `inputs: string[]` array — each entry is sent sequentially to the agent on the same thread, and scorers see the accumulated output from all turns.

**What changed**
- `RunEvalsDataItem` accepts an optional `inputs` array for multi-turn conversations
- Each turn runs `agent.generate()` with the same `threadId`, preserving conversation history
- `runEvals` injects both a shared `threadId` and a `resourceId` (Mastra memory scopes messages by resource + thread, so both are needed for recall); the resource defaults to the generated thread and a caller-provided `targetOptions.memory.resource` is preserved. `thread` is now optional in `targetOptions.memory` since `runEvals` owns it.
- Scorers receive the accumulated output messages from all turns
- Works with gates, thresholds, and all existing scorer configurations
- Validation rejects empty `inputs` arrays with a `MastraError`

Also added a `turns` API for **per-turn assertions**. Instead of a single holistic score over the accumulated conversation (which can hide a broken follow-up turn), each turn colocates its `input` with `gates`/`scorers` that evaluate only that turn's input and output. Per-turn outcomes are reported in `result.turnResults` and folded into the overall `verdict`. When the agent has storage configured, per-turn scorer/gate results are persisted like top-level scores. `turns` is Agent-only and mutually exclusive with `input`/`inputs`.

**Example — holistic multi-turn (`inputs`)**
```ts
import { runEvals } from '@mastra/core/evals'
import { checks } from '@mastra/evals/checks'

const result = await runEvals({
  target: weatherAgent,
  data: [
    {
      inputs: [
        'What is the weather in Brooklyn?',
        'What about tomorrow?',
        'Compare the two forecasts.',
      ],
    },
  ],
  scorers: [
    checks.calledTool('get_weather', { times: 2 }),
    checks.includes('Brooklyn'),
  ],
})
```

**Example — per-turn assertions (`turns`)**
```ts
const result = await runEvals({
  target: weatherAgent,
  data: [
    {
      turns: [
        {
          input: 'What is the weather in Brooklyn?',
          gates: [checks.calledTool('get_weather')],
        },
        {
          input: 'What about tomorrow?',
          gates: [checks.calledTool('get_weather')], // must call again this turn
          scorers: [{ scorer: checks.similarity('tomorrow forecast'), threshold: 0.5 }],
        },
      ],
    },
  ],
})

result.verdict // folds in per-turn gate/threshold outcomes
result.turnResults // [{ index, gateResults, thresholdResults, scores }]
```
