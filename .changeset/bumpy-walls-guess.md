---
'@mastra/core': minor
---

Added classifier registration on `Mastra`.

Classifiers can now be passed to `new Mastra({ classifiers })` and accessed with `getClassifier`, `getClassifierById`, `listClassifiers`, `addClassifier`, and `removeClassifier`.

```ts
const mastra = new Mastra({ classifiers: { router } });
const classifier = mastra.getClassifier('router');
```
