---
'@mastra/client-js': patch
---

Fixed agent streams hiding errors that happen partway through a reply. Before, `processDataStream()` resolved with the partial text and the error was only logged, so apps such as `useChat` from `@mastra/react` showed a cut-off answer as if it were complete. Now `processDataStream()` rejects with the error after the partial text has reached `onChunk`, and reading `response.body` directly ends with that error. Stopping a stream on purpose still ends it quietly.

```ts
const response = await agent.stream('Write a long answer');
try {
  await response.processDataStream({ onChunk: chunk => render(chunk) });
} catch (error) {
  showError(error); // e.g. the provider was overloaded mid-reply
}
```
