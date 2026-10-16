---
'@mastra/code-sdk': minor
---

Added an `outputProcessors` option to `createMastraCode`. Output processors you pass run after Mastra Code's built-in ones and before memory saves the reply, so changes they make to response messages are persisted.

```ts
const mastraCode = await createMastraCode({
  outputProcessors: ({ requestContext }) => [new ReplyLabelProcessor(requestContext)],
});
```
