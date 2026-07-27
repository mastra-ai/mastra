---
'@mastra/core': minor
---

Channel reaction tools (`add_reaction`, `remove_reaction`) are no longer injected into a channel-bearing agent's toolset automatically. Replies are unaffected — they stream back to the channel without a tool. If you want your agent to react to channel messages, add the tools explicitly:

```ts
const channels = new AgentChannels({
  adapters: { slack: createSlackAdapter() },
});

const agent = new Agent({
  name: 'assistant',
  model: 'openai/gpt-5',
  channels,
  tools: { ...channels.getTools() },
});
```
