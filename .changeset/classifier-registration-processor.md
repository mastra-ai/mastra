---
'@mastra/core': minor
---

Added classifier registration on `Mastra` and a `ClassifierProcessor` for classifier-based guardrails.

Classifiers can now be passed to `new Mastra({ classifiers })` and retrieved with `getClassifier`, `getClassifierById`, `listClassifiers`, `addClassifier`, and `removeClassifier`. Registration wires the classifier to Mastra's logger and observability.

`ClassifierProcessor` runs a `Classifier` over agent input, output, or stream chunks and passes the typed answers to `onResult`, which can `abort(reason)` to tripwire the request or `filter()` to drop the content.

```ts
import { ClassifierProcessor } from '@mastra/core/processors';

const guardrail = new ClassifierProcessor({
  classifier: safetyClassifier,
  onResult: (answers, { abort }) => {
    if (answers.unsafe.probability > 0.8) abort('Message rejected');
  },
});
```

Agents now call `__registerMastra` on every processor in their `inputProcessors` and `outputProcessors` arrays when registered with Mastra, even when another agent already registered a processor with the same id. Previously the second instance never received the Mastra reference.
