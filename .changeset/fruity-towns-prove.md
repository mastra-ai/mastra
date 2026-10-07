---
'@mastra/livekit': minor
---

Added a browser-safe `@mastra/livekit/client` entry point for recording playback. It exports `getLiveKitRecording`, `LiveKitRecording`, and `LiveKitRecordingResponse`, reusing a Mastra client's authentication and fetch configuration without importing LiveKit server or worker code.

Applications using the client entry point need `@mastra/client-js` 1.51.2 or newer within 1.x. The SDK is an optional peer; server and worker imports do not require it.

If you used `client.getLiveKitRecording(traceId)` in an earlier snapshot, replace it with:

```ts
import { getLiveKitRecording } from '@mastra/livekit/client';

const recording = await getLiveKitRecording(client, traceId);
```

Studio now uses this entry point for Review Audio.
