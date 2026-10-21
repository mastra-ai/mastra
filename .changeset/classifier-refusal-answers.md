---
'@mastra/core': patch
---

Classifiers now accept `refusal` answers from decision models instead of throwing. Previously, when a decision model refused one question, `decide()` failed with `Answer '<question>' does not match its question type.` and any workflow `.classifier()` step failed the run.

A refused question now returns `{ type: 'refusal' }` while the other questions keep their answers. `RefusalAnswer` is exported and included in every `ClassifierAnswer` type. Refusals have no `choice`, `score`, or `probability`, so equality checks such as `answers.route.choice === 'billing'` evaluate to `false`; check `type === 'refusal'` before relying on numeric fields.

```ts
const { answers } = await classifier.decide({ state })

if (answers.unsafe.type === 'refusal') {
  // Route to review, block, or apply a default.
}
```

Classifier scorers fail with an error naming the refused question, and `ModelSelectionProcessor` keeps the configured model and reports `abstained: 'refused'`.
