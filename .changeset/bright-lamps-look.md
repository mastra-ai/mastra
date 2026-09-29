---
'@mastra/memory': minor
---

Added `viewAttachment` to the observational memory `recall` tool. Passing it with `cursor` and `partIndex` shows the attachment itself to the model instead of only describing it: inline data is sent as a native media part, and `http(s)` URLs are sent as `image-url` or `file-url` parts for the provider to fetch. Media types outside `image/*` and `application/pdf`, provider file IDs, and payloads over 10 MiB come back as an explanation instead.

```ts
recall({ mode: 'messages', cursor: 'msg_123', partIndex: 0, viewAttachment: true });
```
