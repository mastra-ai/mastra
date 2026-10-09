---
'@mastra/core': patch
---

`Classifier` now supports AI SDK decision models. Pass a model from a provider's `decisionModel()` factory and Mastra calls `doDecide()`. Models that only implement the deprecated `doEvaluate()` contract still work. `ClassifierProcessor`, `ModelSelectionProcessor`, and classifier scorers accept the same models.

To match the AI SDK naming, `Classifier.decide()` replaces `Classifier.evaluate()` and `MastraDecisionModel` replaces `MastraEvaluationModel`. The old names are deprecated aliases and will be removed in a future release. `EvaluationModelResult`, `MastraEvaluationModelInterface`, `ConfiguredClassifierEvaluateOptions`, and `PerCallClassifierEvaluateOptions` are likewise deprecated in favor of their `Decision`/`Decide` counterparts.

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

const result = await classifier.decide({ state: 'My order never arrived' });
```
