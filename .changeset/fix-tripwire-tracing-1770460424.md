---
'@mastra/core': patch
---

Fixed processor trip-wire aborts not being traced properly. When processors trigger trip-wire aborts (via the abort() function), the processor span is now correctly ended with metadata including the abort reason, retry flag, and processor ID. This ensures abort events appear in observability platforms and tracing systems. Fixes `#12163`.
