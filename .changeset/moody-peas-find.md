---
'@mastra/core': minor
'@mastra/code-sdk': patch
---

Added the authoritative session scope to agent controller request context for scoped session integrations.

```ts
const controllerContext = requestContext.get('controller')
console.log(controllerContext?.scope)
```
