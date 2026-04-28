---
'@mastra/client-js': major
---

Improved A2A client parity, typed streaming, and unwrapped results

Added missing A2A client methods for authenticated extended cards and push notification config lookup so the Mastra client matches the server router more closely.

Deprecated `getCard()` in favor of `getAgentCard()` and deprecated `sendStreamingMessage()` in favor of `sendMessageStream()`.

Non-streaming A2A methods now return the underlying protocol objects instead of raw JSON-RPC response envelopes, and JSON-RPC errors are now thrown as protocol-aware client errors.

**Before**

```ts
const a2a = client.getA2A('weather-agent');
const card = await a2a.getCard();
const response = await a2a.sendMessage(params);
```

**After**

```ts
const a2a = client.getA2A('weather-agent');
const card = await a2a.getAgentCard();
const response = await a2a.sendMessage(params);
for await (const event of a2a.sendMessageStream(params)) {
  console.log(event.kind);
}
```

**Why**

This makes the Mastra A2A client feel closer to the official A2A SDK while keeping the Mastra-native `getA2A(agentId)` entrypoint.
