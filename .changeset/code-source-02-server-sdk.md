---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added server and client APIs for source-backed stored agent workflows.

The stored agent API can now report editor source capabilities, export owned agent override JSON, and open provider-backed change requests from the server. The client SDK exposes matching methods so Studio and other clients can use the same stored-agent workflow without calling a source provider directly.

```ts
const storedAgent = client.getStoredAgent('weather-agent');
const exported = await storedAgent.export({ instructions: '...' });
await storedAgent.openChangeRequest({
  instructions: '...',
  changeMessage: 'Tune weather instructions',
});
```
