---
'@mastra/deployer': patch
'@internal/playground': patch
---

Add MASTRA_SERVER_URL support and auto-detect from request origin

The playground now automatically uses `window.location.origin` as the server URL, so cloud deployments work without any configuration. Users visiting `https://myapp.com/` will have the playground connect to that URL automatically.

You can still override with `MASTRA_SERVER_URL` env var if needed:

```bash
MASTRA_SERVER_URL=https://custom-api.com node ./index.mjs
```
