---
'@mastra/factory': patch
---

Fixed the Factory board showing a raw "Invalid API key" with a Retry that could never work when Mastra Platform rejects the server's own credentials. The board now shows one notice telling users that whoever manages the Factory needs to check its Platform connection, and Linear no longer asks users to reconnect for this server-side failure. The server log names the credential that was rejected (`MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY`).
