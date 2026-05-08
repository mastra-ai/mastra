---
'@mastra/core': patch
---

Added denied tool approval events to the UI stream.

When a user declines a tool approval, the stream now includes a denied tool output event with a reason.

```ts
harness.subscribe(event => {
  if (event.type === 'tool_end' && event.denied) {
    console.log(event.deniedReason);
  }
});
```
