---
'@mastra/livekit': patch
---

Fixed `liveKitConnectionRoute()` to return HTTP 409 when recording is requested for an existing room, without dispatching an agent or issuing a participant token. Use a unique `roomName` for each recorded call.

Programmatic callers of `dispatchVoiceSession()` can distinguish this conflict with the exported `LiveKitRecordingRoomConflictError`:

```ts
import { dispatchVoiceSession, LiveKitRecordingRoomConflictError } from '@mastra/livekit';

try {
  await dispatchVoiceSession({ roomName, recording });
} catch (error) {
  if (error instanceof LiveKitRecordingRoomConflictError) {
    console.error(`Room ${error.roomName} already exists; start the call with a fresh room name.`);
  } else {
    throw error;
  }
}
```
