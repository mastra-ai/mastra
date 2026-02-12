---
'@mastra/client-js': patch
---

Fix `base64RequestContext` to handle non-ASCII characters (e.g. CJK, em-dashes, emoji) without throwing `InvalidCharacterError`. The previous implementation used `btoa()` directly, which only supports Latin1 characters. Now encodes via `TextEncoder` to UTF-8 bytes first, which is compatible with the existing server-side `Buffer.from(str, 'base64').toString('utf-8')` decode.
