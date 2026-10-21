---
'@mastra/core': minor
---

Added a `textDisplay` channel adapter option. Set `textDisplay: 'hidden'` to stop posting the agent's reply text, for example when the agent replies through a tool you give it. Tool display, approval prompts, errors and typing status still show, and the text still reaches the agent's stream and memory.

```ts
channels: {
  adapters: {
    slack: {
      adapter: createSlackAdapter(),
      textDisplay: 'hidden',
    },
  },
},
```
