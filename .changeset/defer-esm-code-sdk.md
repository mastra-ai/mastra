---
'@mastra/code-sdk': minor
---

**Breaking:** Token estimation and context auditing now return promises.

Before:

```ts
const tokens = tokenEstimate(text);
```

After:

```ts
const tokens = await tokenEstimate(text);
```

This lets token utilities load safely at runtime.
