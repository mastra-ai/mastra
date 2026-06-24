---
'@mastra/core': minor
---

Added multi-turn support to `runEvals`. Data items can now include an `inputs: string[]` array — each entry is sent sequentially to the agent on the same thread, and scorers see the accumulated output from all turns.

**What changed**
- `RunEvalsDataItem` accepts an optional `inputs` array for multi-turn conversations
- Each turn runs `agent.generate()` with the same `threadId`, preserving conversation history
- Scorers receive the accumulated output messages from all turns
- Works with gates, thresholds, and all existing scorer configurations
- Validation rejects empty `inputs` arrays with a `MastraError`

**Example**
```ts
import { runEvals } from '@mastra/core/evals'
import { checks } from '@mastra/evals/checks'

const result = await runEvals({
  target: weatherAgent,
  data: [
    {
      input: '',
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
