---
'@mastra/livekit': minor
---

Added opt-in phone call setup through native LiveKit APIs. Outbound workers wait for an answer before greeting, and inbound workers can resolve agent and memory routing from the native caller. Failed setup preserves native SIP errors and supports explicit room cleanup.

Phone setup previously required a custom worker entrypoint. Keep the existing `dispatchVoiceSession()` call and configure the worker to dial after connecting:

```typescript
import { createLiveKitWorker } from '@mastra/livekit/worker';
import { LiveKitAPI } from 'livekit-server-sdk';
import { mastra } from './index';

const livekit = new LiveKitAPI();

export default createLiveKitWorker({
  mastra,
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  telephony: ({ metadata }) => {
    const phoneNumber = metadata.requestContext?.phoneNumber;
    if (typeof phoneNumber !== 'string') throw new Error('Missing authorized destination');
    return {
      direction: 'outbound',
      sipClient: livekit.sip,
      sipTrunkId: process.env.SIP_OUTBOUND_TRUNK_ID!,
      phoneNumber,
      deleteRoomOnFailure: livekit.room,
    };
  },
});
```

Use `direction: 'inbound'` with `resolveMetadata` to select the agent, memory identifiers, and request context from the native caller before the conversation starts. Return `undefined` from a telephony resolver for browser sessions. Omitting `telephony` preserves existing behavior.

Room deletion is opt-in and intended for dedicated call rooms. Native errors and cleanup failures remain observable; this does not add durable delivery, automatic redial, or a separate call state model.
