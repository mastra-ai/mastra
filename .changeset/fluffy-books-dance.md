---
'mastra': patch
---

Fixed `mastra init` writing corrupted API keys to `.env` on Windows, including values containing `=` or shell metacharacters.
