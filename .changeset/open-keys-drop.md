---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
---

Fixed `listMessagesById`, `updateMessages` and `deleteMessages` failing with "too many SQL variables" once a thread holds more than ~100 messages (#30858).
