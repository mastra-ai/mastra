---
'mastra': minor
---

Added CLI options to configure Mastra Studio runtime settings, allowing you to customize the server connection details, and protocol.

You can now override the default studio configuration using command-line arguments:

```bash
mastra studio \
  --server-host api.example.com \
  --server-port 8080 \
  --server-protocol https
```

These options configure the `window.MASTRA_*` environment variables that the Studio frontend uses to connect to your API server.
