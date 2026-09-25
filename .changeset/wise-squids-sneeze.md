---
'@mastra/core': patch
---

Fixed file and image parts with a relative path (for example `/api/images/foo.png`) breaking every later turn of a thread. Mastra used to treat the path as base64 and store a data URL that could never be downloaded. It now stores the path as sent, and the agent answers with an `[Attachment unavailable: <name>]` placeholder and logs a warning, since a relative path can't be downloaded. Protocol-relative URLs such as `//cdn.example.com/a.png` get the same placeholder instead of being sent to the model. Non-http URLs such as `gs://` and `s3://` are no longer mistaken for base64, and attachment download errors no longer print the whole data URL payload. See #23705.
