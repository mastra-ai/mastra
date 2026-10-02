---
'@mastra/core': patch
---

Fixed a relative attachment path (for example `/api/images/foo.png`) breaking every later turn of a thread. The conversation now continues: the model sees an `[Attachment unavailable: <name>]` placeholder and a warning is logged. Protocol-relative URLs such as `//cdn.example.com/a.png` get the same placeholder, as does inline content that can't be decoded, isn't the image or PDF it's labelled as, or is a path rather than file data, including relative paths already stored as data URLs. Percent-encoded data URLs such as `data:image/svg+xml,%3Csvg...` now reach the model intact. `gs://` and `s3://` URLs are no longer mistaken for base64, and download errors no longer print data URL payloads. See #23705.
