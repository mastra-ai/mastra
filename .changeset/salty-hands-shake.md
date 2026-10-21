---
'@mastra/core': minor
---

Added a `textDisplay` channel adapter option. Set `textDisplay: 'hidden'` to stop posting the agent's reply text, so the agent speaks in the channel only through tools you give it, such as a reply tool. Tool display, approval prompts, errors and typing status are unchanged.

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
