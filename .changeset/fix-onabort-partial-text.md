---
'@mastra/core': patch
---

Callers now receive accumulated partial response text in `onAbort` events when streaming is cancelled mid-generation, so partial LLM output is no longer lost on user cancellation.

Previously the `onAbort` callback received `{ steps: [] }` with no text, making it impossible to save or display what was generated before cancellation. The callback now provides a `text` field:

```ts
agent.stream(messages, {
  onAbort: ({ steps, text }) => {
    // text contains whatever was generated before cancellation
    console.log('partial response:', text)
  }
})
```
