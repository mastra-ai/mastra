---
'@mastra/livekit': minor
---

Added a per-call `configuration.turnDetection` resolver to `createLiveKitWorker()`. LiveKit's `TurnDetector` classes need the job's inference executor, so they could not be constructed at module scope where worker options live; the resolver runs inside each job with the call context and falls back to the top-level `turnDetection` option. Fixes #22495.
