---
'mastra': patch
---

Factory now shows an alert banner above every page when it can't decrypt its stored secrets, so users see the problem right away instead of finding it page by page. The banner says the secrets are safe, shows the env var to redeploy with, and links to the docs. Pages and settings stay usable underneath. Settings pages also show a server's readable error message instead of its error code.
