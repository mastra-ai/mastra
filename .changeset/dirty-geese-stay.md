---
'@mastra/core': patch
---

The warning about passing resourceId and threadId without configuring memory now also appears for Mastra gateway models. It was suppressed for them, on the assumption the gateway supplied memory, which it no longer does.
