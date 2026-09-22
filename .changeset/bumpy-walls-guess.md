---
'@mastra/core': minor
---

Added classifier registration on `Mastra`.

Classifiers can now be passed to `new Mastra({ classifiers })` and accessed with `getClassifier`, `getClassifierById`, `listClassifiers`, `addClassifier`, and `removeClassifier`. Registered classifiers evaluated without an active trace start a root `CLASSIFIER_EVALUATION` span through the `Mastra` instance's configured observability provider.

```ts
const mastra = new Mastra({ classifiers: { router } });
const classifier = mastra.getClassifier('router');
```
