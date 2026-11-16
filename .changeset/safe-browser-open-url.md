---
'mastra': patch
---

Hardened how the CLI opens your browser (login, `mastra connect`, add credits). Only `http://` and `https://` URLs are opened now, and on Windows the URL is no longer passed through `cmd.exe`, which could interpret characters like `&` as extra commands and also truncated login URLs with multiple query parameters.
