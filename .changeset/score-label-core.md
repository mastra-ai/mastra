---
'@mastra/core': minor
---

Added an optional categorical `label` to scorer results. A scorer can return `{ score, label }` from `generateScore` (for example `{ score: 0, label: 'failing' }`), and `createClassifierScorer()` sets the label to the chosen key of a choice question. The label is stored with the score, returned on each dataset experiment item result, and accepted by `submitExperimentResult()` scores, so one failing result is not hidden by an average such as `0.833`. Scorers that return a plain number are unchanged.

```ts
const safetyGrade = createScorer({ id: 'safety-grade', description: 'Grades safety', type: 'agent' })
  .analyze(({ run }) => ({ grade: gradeConversation(run.output) }))
  .generateScore(({ results }) => ({
    score: { failing: 0, adequate: 0.5, exemplary: 1 }[results.analyzeStepResult.grade],
    label: results.analyzeStepResult.grade,
  }));
```

Closes #22806.
