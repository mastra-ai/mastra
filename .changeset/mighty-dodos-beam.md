---
'mastra': patch
---

`mastra connect` now authorizes against the Nango host returned with the connect session, so it works with a self-hosted Nango. The host must use HTTPS (plain HTTP is allowed for localhost). `MASTRA_NANGO_HOST` still overrides it when set.
