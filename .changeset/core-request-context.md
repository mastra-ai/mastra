---
'@mastra/core': minor
---

Added `requestContext` support to the datasets API. Datasets can now define a `defaultRequestContext` and `requestContextSchema` for validation. Dataset items accept an optional `requestContext` field. This enables passing execution context (e.g. headers, auth tokens) when running experiments.

**Creating a dataset with request context:**

```ts
const ds = await mastra.datasets.create({
  name: 'my-dataset',
  defaultRequestContext: { authorization: 'Bearer xxx' },
  requestContextSchema: z.object({ authorization: z.string() }),
});
```

**Adding items with request context:**

```ts
await ds.addItem({
  input: { query: 'hello' },
  groundTruth: { answer: 'world' },
  requestContext: { authorization: 'Bearer yyy' },
});
```
