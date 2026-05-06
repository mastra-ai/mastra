---
'@mastra/server': minor
---

Responses streams now emit tool call events so clients can track tool arguments and results in real time.

Tool outputs now use consistent IDs (`<toolCallId>:output`) so streamed arguments can be matched to completed results.

```ts
for await (const event of stream) {
  if (event.type === 'response.function_call_arguments.delta') {
    console.log(event.delta);
  }

  if (event.type === 'response.output_item.done' && event.item.type === 'function_call') {
    console.log(event.item.id);
  }
}
```
