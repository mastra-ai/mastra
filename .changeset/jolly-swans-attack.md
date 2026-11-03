---
'@mastra/livekit': minor
---

Added opt-in shared session configuration for LiveKit dispatchers and workers. Validate per-call speech and turn settings with `LiveKitSessionMetadataSchema`, then enable `sessionConfigFromMetadata` on the receiving worker. The settings use LiveKit's native session APIs. Existing callers keep their current behavior.

Before, per-call settings required a worker-side metadata resolver:

```typescript
import { createLiveKitWorker } from '@mastra/livekit/worker';

export default createLiveKitWorker({
  mastra,
  configuration: {
    tts: ({ metadata }) => metadata.requestContext?.voiceModel as string | undefined,
  },
});
```

After, the server and worker share a validated contract:

```typescript
import { dispatchVoiceSession, LiveKitSessionMetadataSchema } from '@mastra/livekit';

await dispatchVoiceSession({
  roomName: 'support-call-42',
  metadata: LiveKitSessionMetadataSchema.parse({
    agentId: 'support',
    sessionConfig: { version: 1, options: { tts: 'cartesia/sonic-3' } },
  }),
});
```

```typescript
import { createLiveKitWorker } from '@mastra/livekit/worker';

export default createLiveKitWorker({ mastra, sessionConfigFromMetadata: true });
```

Worker speech resolvers and explicit `sessionOptions` retain precedence. Validation rejects unsupported configuration versions and fields only when enabled. The shared schemas and `parseSessionMetadata` are available from the server-safe package entry point.
