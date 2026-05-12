---
'@mastra/client-js': minor
---

Added streamed function-call argument events to `@mastra/client-js` Responses streams. You can now read finalized tool arguments directly from the stream:

```ts
for await (const event of stream) {
  if (event.type === 'response.function_call_arguments.done') {
    console.log(event.arguments);
  }
}
```
