---
'@mastra/nestjs': patch
---

Fixed Studio client-type detection to read the x-mastra-client-type header via request.headers instead of the Express-only request.get(), matching how the adapter reads headers everywhere else.
