---
'@mastra/core': major
---

Removed `agent.network()`. Use a supervisor agent instead: give the agent sub-agents and call `stream()` or `generate()`.

```ts
// Before
const stream = await routingAgent.network('Research AI in education');

// After
const supervisor = new Agent({ id: 'supervisor', model, instructions, agents: { researcher, writer } });
const stream = await supervisor.stream('Research AI in education');
```

Also removed `resumeNetwork()`, `approveNetworkToolCall()`, `declineNetworkToolCall()`, `getDefaultNetworkOptions()`, the `defaultNetworkOptions` agent option, `NetworkOptions`, `MastraAgentNetworkStream`, network chunk types and `ChunkFrom.NETWORK`. See the [.network() to supervisor agents guide](https://mastra.ai/reference/migrations/network-to-supervisor).
