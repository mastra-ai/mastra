---
'@mastra/core': minor
---

Added classifier registration on `Mastra` and a `ClassifierProcessor` for classifier-based guardrails.

Classifiers can now be passed to `new Mastra({ classifiers })` and retrieved with `getClassifier`, `getClassifierById`, `listClassifiers`, `addClassifier`, and `removeClassifier`. Registration wires the classifier to Mastra's logger and observability.

`ClassifierProcessor` runs a `Classifier` over agent input, output, or stream chunks and applies a caller-supplied `decide` policy that returns `pass`, `block`, or `filter`. Built-in `decisions.blockIf`, `decisions.blockUnless`, and `decisions.all` helpers generate typed policies for common cases.

```ts
import { ClassifierProcessor, decisions } from '@mastra/core/processors';

const guardrail = new ClassifierProcessor({
  classifier: safetyClassifier,
  decide: decisions.blockIf('unsafe', { probability: 0.8, reason: 'Message rejected' }),
});
```

Agents now call `__registerMastra` on every processor in their `inputProcessors` and `outputProcessors` arrays when registered with Mastra, even when another agent already registered a processor with the same id. Previously the second instance never received the Mastra reference.
