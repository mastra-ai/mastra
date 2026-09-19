---
'@mastra/core': minor
---

Added a typed Classifier primitive for fixed-option evaluation with AI SDK evaluation models.

```ts
import { Classifier } from '@mastra/core/classifier';

const classifier = new Classifier({ id: 'router', model });
const result = await classifier.evaluate({
  state: request,
  questions: {
    route: {
      type: 'choice',
      criteria: { support: 'Support request', sales: 'Sales request' },
    },
  },
});
```
