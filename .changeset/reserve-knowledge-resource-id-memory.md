---
'@mastra/memory': patch
---

Subconscious Knowledge now reads its resource override only from the reserved `mastra__knowledgeResourceId` request-context key. Previously a plain `knowledgeResourceId` entry — which an HTTP caller could send in the request body — could point Knowledge at a resource the caller was never authorized for. Hosts that set the override in middleware should use the new key.

```ts
// Before
requestContext.set('knowledgeResourceId', projectId);
// After
requestContext.set('mastra__knowledgeResourceId', projectId);
```
