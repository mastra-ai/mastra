---
'@mastra/core': patch
---

`Classifier` now supports AI SDK decision models. Pass a model from a provider's `decisionModel()` factory and Mastra calls `doDecide()`. Models that only implement the deprecated `doEvaluate()` contract still work. `ClassifierProcessor`, `ModelSelectionProcessor`, and classifier scorers accept the same models.

```ts
import { openai } from '@ai-sdk/openai';
import { Classifier } from '@mastra/core/classifier';

const classifier = new Classifier({
  id: 'support-router',
  model: openai.decisionModel('gpt-6-luna'),
  questions: {
    urgent: { type: 'boolean', instructions: 'Is this request urgent?' },
  },
});
```
