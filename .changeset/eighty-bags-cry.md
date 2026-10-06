---
'@mastra/client-js': minor
---

Added `getLiveKitRecording(traceId)` and `GetLiveKitRecordingResponse` to request a fresh playback URL for a recorded voice call. The application must register `liveKitRecordingRoute()` and authorize access to the trace.

```ts
const recording = await client.getLiveKitRecording(traceId);
if (recording.status === 'ready') {
  audio.src = recording.url;
}
```
