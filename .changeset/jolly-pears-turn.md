---
'@mastra/server': minor
---

Added `liveKitRecordingRouteEnabled` to the system packages response when a GET route is registered at `/voice/livekit/recordings/:traceId`. Studio uses this flag to discover recording playback support.

```ts
const packages = await client.getSystemPackages();
if (packages.liveKitRecordingRouteEnabled) {
  // Show recording controls for voice call traces.
}
```
