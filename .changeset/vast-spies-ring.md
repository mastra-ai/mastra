---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
---

Fixed subscribed client tools so browser-executed tool results continue through the existing thread subscription instead of opening and canceling a second stream. This prevents closed-stream errors in apps like Agent Builder when multiple client tools run during one response.
