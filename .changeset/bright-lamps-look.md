---
'@mastra/memory': minor
---

Added `viewAttachment` to the observational memory `recall` tool. Passing it with `cursor` and `partIndex` shows the attachment itself to the model instead of only describing it. Inline data such as base64 or data URIs is sent as a native media part. Attachments stored as remote URLs or provider file IDs, media types outside `image/*` and `application/pdf`, and payloads over 10 MiB come back as an explanation instead.

```ts
recall({ mode: 'messages', cursor: 'msg_123', partIndex: 0, viewAttachment: true });
```
