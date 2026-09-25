---
'@mastra/core': patch
---

Fixed a relative attachment path (for example `/api/images/foo.png`) breaking every later turn of a thread. The conversation now continues: the model sees an `[Attachment unavailable: <name>]` placeholder and a warning is logged. Protocol-relative URLs such as `//cdn.example.com/a.png` get the same placeholder. `gs://` and `s3://` URLs are no longer mistaken for base64, and download errors no longer print data URL payloads. See #23705.
