---
'@mastra/core': minor
---

Added `ClassifierProcessor` for applying typed classifier policies to agent input, output, and streaming content.

```typescript
import { Agent } from '@mastra/core/agent'
import { Classifier } from '@mastra/core/classifier'
import { ClassifierProcessor } from '@mastra/core/processors'

const safety = new Classifier({
  id: 'safety',
  model,
  questions: {
    unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
  },
})

const agent = new Agent({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Answer support questions.',
  model: 'openai/gpt-5-mini',
  inputProcessors: [
    new ClassifierProcessor({
      classifier: safety,
      onResult: (answers, { abort }) => {
        if (answers.unsafe.probability > 0.8) abort('Rejected by safety policy')
      },
    }),
  ],
})
```
