---
'@mastra/core': patch
---

Fixed file and image parts with a relative path (for example `/api/images/foo.png`) breaking every later turn of a thread. Mastra used to treat the path as base64 and store a data URL that could never be downloaded. It now rejects the message right away with an `INVALID_FILE_PART_DATA` error, so send an absolute URL or base64 content instead. Non-http URLs such as `gs://` and `s3://` are no longer mistaken for base64, and attachment download errors no longer print the whole data URL payload. See #23705.
