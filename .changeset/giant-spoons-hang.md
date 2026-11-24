---
'@mastra/playground-ui': patch
---

Headless Connect in Studio now uses the Nango host returned with the connect session, so connecting accounts works against a self-hosted Nango. Without a host it keeps using Nango Cloud. The host must use HTTPS (plain HTTP is allowed for localhost).
