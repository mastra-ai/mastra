---
'@mastra/client-js': minor
'@mastra/react': minor
---

Added client SDK support for streaming agents from custom endpoints with client-side tools:

- `clientToolsResolver` on generate and stream params resolves client tools at call time instead of requiring them up front. It works on both streaming paths: the legacy stream route and thread signals, where tools are re-resolved before each execution and continuation round.
- Streamed partial tool calls now merge their accumulated arguments before `onToolCall` fires, so handlers always see complete arguments.
- `client.getAgent(agentId, version, { stream: "/custom/stream" })` overrides the agent stream route, and `useChat` in `@mastra/react` accepts a matching `streamPath` option.
- New `client.getWorkflowBuilderSettings()` reports whether the Studio workflow builder is available.

```ts
// Stream an agent from a custom endpoint, resolving client tools at call time
const agent = client.getAgent('my-agent', undefined, { stream: '/custom/stream' });

await agent.stream('Hello', {
  clientToolsResolver: () => getMyCurrentTools(),
});
```

```tsx
// Same thing from React
const chat = useChat({ agentId: 'my-agent', streamPath: '/custom/stream' });

await chat.sendMessage({
  mode: 'stream',
  message: 'Hello',
  clientToolsResolver: () => getMyCurrentTools(),
});
```
