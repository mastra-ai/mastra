---
'@mastra/connect': patch
---

Agents can now continue a task as soon as an end user connects a provider.

- **`request_connection` waits for the connection:** inside an agent run, the tool pauses the run while the connect prompt is shown. The chat UI resumes the tool once the connection activates. The tool then checks the platform and returns the prompt with a `message` such as `"Linear connected successfully."`, and the agent continues from that tool result. No chat message is involved. If the requested provider is already connected, or the tool runs outside an agent, it returns the prompt right away as before.

```ts
// Resume data a chat UI passes back once the user's connection is active
const resumeData: ConnectPromptResume = { provider: 'linear', status: 'active' };
await agent.resumeStream(resumeData, { runId, toolCallId });
```

- **New tools show up right away:** a connect or disconnect through `userConnectRoutes()` refreshes the cached tool list on the next resolution. Before, the change could take up to 30 seconds to appear.
