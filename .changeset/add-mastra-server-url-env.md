---
'@mastra/deployer': patch
'@internal/playground': patch
---

Add MASTRA_SERVER_URL environment variable support for cloud deployments

Allows setting the full server URL via environment variable when running the playground in containerized/cloud environments where the external URL differs from the internal host/port.

```bash
MASTRA_SERVER_URL=https://myapp.com node ./index.mjs
```

When set, this takes priority over the constructed `${protocol}://${host}:${port}` endpoint.
