---
'@mastra/core': minor
'@mastra/slack': minor
---

Added experimental `generativeUI` option to the Slack channel adapter. When enabled, the agent gets a `render_card` tool that posts [json-render](https://json-render.dev) specs as Block Kit cards: fields, tables, charts, images, and link buttons. Invalid specs are returned to the agent as a list of issues so it can fix and retry. Requires the optional `@json-render/chat` package.

```ts
channels: {
  adapters: {
    slack: { adapter: createSlackAdapter(), generativeUI: true },
  },
}
```
