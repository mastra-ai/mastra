---
'@mastra/core': patch
---

Fixed the response cache serving one image's answer for a different image. `ResponseCache` derives its key from the resolved prompt, but URL-valued image and file parts were serialized as `{}`, so two requests that differed only in which image they pointed at collided on the same cache entry. URLs now contribute their full href, and inline binary data contributes a digest of its bytes instead of being expanded one property per byte (which turned a 1 MiB image into ~11 MiB of intermediate JSON, hashed synchronously before every model call).
