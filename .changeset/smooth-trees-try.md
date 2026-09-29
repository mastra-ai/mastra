---
'@mastra/factory': patch
---

Fixed the Factory board showing a raw "Invalid API key" with a Retry that could never work when Mastra Platform rejects the server's own Platform key. The board now shows one notice explaining that whoever runs the server must set a valid `MASTRA_PLATFORM_SECRET_KEY` (or `MASTRA_PLATFORM_ACCESS_TOKEN`) and restart it, and Linear no longer asks users to reconnect for this server-side failure.
