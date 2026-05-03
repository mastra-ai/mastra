---
'@mastra/memory': patch
---

Observers no longer receive raw base64 media in prompts. This prevents token overflows and broken responses when tool results include images or files.

Media from tool results is now sent as attachments. The prompt keeps a short placeholder like `[Image #1: image/png]`, so the observer still has positional context without seeing the raw bytes.
