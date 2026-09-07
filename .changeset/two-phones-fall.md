---
'@mastra/server': patch
---

`GET /api/system/packages` now reports `liveKitConnectionRouteEnabled`, true when the default `@mastra/livekit` connection-details route is mounted, so clients can tell whether Studio voice calls will work.
