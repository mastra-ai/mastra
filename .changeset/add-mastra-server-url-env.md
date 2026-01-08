---
'@mastra/deployer': patch
---

Add MASTRA_AUTO_DETECT_URL env var to auto-detect server URL from browser origin

When set to `true`, the playground uses `window.location.origin` as the server URL. This makes cloud deployments work without needing to know the URL ahead of time.

```bash
MASTRA_AUTO_DETECT_URL=true node ./index.mjs
```

Users visiting `https://myapp.com/` will have the playground automatically connect to that URL.
