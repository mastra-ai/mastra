---
'@mastra/memory': patch
---

Fixed recall of image and file attachments to include their saved HTTP(S) URL and media type. Exact-part reads and paged history share the same formatting and existing access checks; inline data remains excluded and long references use native continuation.
