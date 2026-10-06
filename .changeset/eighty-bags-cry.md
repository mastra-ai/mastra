---
'@mastra/client-js': minor
---

Added the optional `liveKitRecordingRouteEnabled` capability to `getSystemPackages()` response types so applications can discover recording review support.

```ts
const packages = await client.getSystemPackages();
if (packages.liveKitRecordingRouteEnabled) {
  // Show recording controls for voice call traces.
}
```
