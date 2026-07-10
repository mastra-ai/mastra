---
'@mastra/platform': patch
---

Fix `PlatformFilesystem` treating reserved URL characters in object keys as URL syntax. Filenames containing `?`, `#`, `%`, `&`, `+`, or spaces were being clipped by the proxy — for example `readFile('/notes/why?.txt')` hit `/fs/bucket/notes/why?.txt`, so the proxy saw key `notes/why` and `.txt` as query text. Every `/fs/:bucketName/:key` request path now percent-encodes each key segment (segment-aware so `/` still separates path parts on the wire).
