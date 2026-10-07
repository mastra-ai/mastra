---
'@mastra/livekit': patch
---

Required an explicit recording authorization callback before trace lookup or playback URL resolution. Missing policies fail at route registration, and denied requests cannot access recording storage.

```ts
// Before: authentication alone did not check recording ownership.
liveKitRecordingRoute({ resolveRecording });

// After: the application verifies access to the requested trace.
liveKitRecordingRoute({ authorize: authorizeRecording, resolveRecording });
```

The authorization callback must return `true` to permit access, including when `requiresAuth` is `false` for a local demo.
