---
'@mastra/server': patch
---

Fixed observed durable agent streams dropping `stopCause` from their `finish` chunk. Reattached HTTP observers now receive the same `stopCause` field as the live stream.
