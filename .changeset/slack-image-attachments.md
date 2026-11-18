---
'@mastra/factory': patch
---

Fixed Factory sessions reading private Slack image attachments directly without copying files to a sandbox. JPEG, PNG, WebP, and GIF images are supported up to a 5 MB encoded model input. After `fetchMessages` identifies the message, the session can call `downloadSlackAttachment` with the message's thread ID, message ID, and zero-based attachment index:

```json
{"threadId":"slack:C123:1700000000.000100","messageId":"1700000000.000100","attachmentIndex":0}
```
