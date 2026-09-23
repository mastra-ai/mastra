---
'@mastra/core': patch
---

`ClassifierProcessor` now fails closed by default. When the classifier call fails, the request is aborted instead of letting unchecked content through. Pass `errorStrategy: 'warn'` to keep the previous fail-open behavior:

```ts
new ClassifierProcessor({ classifier, onResult, errorStrategy: 'warn' });
```
