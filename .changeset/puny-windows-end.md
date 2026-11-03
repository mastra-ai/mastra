---
'@mastra/livekit': minor
---

Added opt-in phone keypad tools using native LiveKit DTMF publishing, with support for local and remote Mastra agents.

Enable the keypad tool for each telephony call with `dtmf: true`:

```typescript
import { createLiveKitWorker } from '@mastra/livekit/worker';
import { mastra } from './src/mastra';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  telephony: { direction: 'inbound' },
  dtmf: true, // Omit this option to keep the previous behavior.
});
```

For custom workers, bind `createDtmfTool()` to the native room, session, and caller, then pass it through `MastraLLM.tools`. Remote agents use the existing optional `@mastra/client-js` dependency to execute the tool in the worker and return its result to the agent.

Use one SIP caller per room and disable preemptive generation. Results report the digits LiveKit acknowledged publishing, including a partial prefix on failure; they do not confirm phone-menu acceptance. No automatic retry or pacing is added.
