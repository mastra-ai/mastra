---
'@mastra/connect': patch
---

Agents can now continue a task as soon as an end user connects a provider.

- **`request_connection` waits for the connection:** inside an agent run, the tool pauses the run while the connect prompt is shown. The chat UI resumes the tool once the connection settles. The tool then checks the platform and returns the prompt with a `message`, and the agent continues from that tool result. No chat message is involved. On success the message reads like `"Linear connected successfully."`. On failure the result also carries an `error` with the reason the user saw, such as a closed authorization window or a reached connection limit, so the agent can explain what went wrong. The platform state wins: a reported failure is ignored if the connection is actually active. The run only pauses when the agent names one specific provider that isn't connected. If the provider is omitted, unknown, or already connected, or the tool runs outside an agent, the tool returns the prompt right away as before.

```ts
// Resume data a chat UI passes back once the user's connection settles
const connected: ConnectPromptResume = { provider: 'linear', status: 'active' };
const failed: ConnectPromptResume = {
  provider: 'linear',
  status: 'failed',
  error: 'The authorization window was closed.',
};
await agent.resumeStream(connected, { runId, toolCallId });
```

- **New tools show up right away:** a connect or disconnect through `userConnectRoutes()` refreshes the cached tool list on the next resolution. Before, the change could take up to 30 seconds to appear.
