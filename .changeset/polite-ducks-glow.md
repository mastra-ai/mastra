---
'@mastra/core': minor
---

Added support for resolving an agent's `voice` per request.

You can now pass `voice` as a resolver, just like `instructions`, `tools`, and `model`. Mastra runs the resolver on each `getVoice()` call and returns a fresh, session-owned voice instance. This fixes concurrent realtime and speech-to-speech sessions on a single deployed agent, where a shared voice instance previously let one session overwrite another session's WebSocket, tools, and instructions.

A static `voice` keeps its existing shared behavior, so this change is backward compatible.

**Before**

```typescript
const agent = new Agent({
  name: 'support-line',
  voice: new GeminiLiveVoice({ apiKey: KEY }), // shared across every session
});
```

**After**

```typescript
const agent = new Agent({
  name: 'support-line',
  voice: ({ requestContext }) => new GeminiLiveVoice({ apiKey: requestContext.get('apiKey') }),
});

const voice = await agent.getVoice({ requestContext }); // owns its own ws/tools/instructions
await voice.connect();
```

The caller owns the lifecycle of a resolver instance and should call `disconnect()` when the session ends. The `agent.voice` getter throws when `voice` is a resolver because it has no request context; use `agent.getVoice({ requestContext })` instead.
