---
'@mastra/core': minor
---

Added a providerless, immutable `Template()` builder for JSON-serializable sandbox build definitions.

```ts
const definition = Template().setWorkdir('/workspace').runCmd('pnpm install').toJSON();
```
