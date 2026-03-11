---
'@mastra/deployer': patch
---

Fixed CORS preflight blocking dev playground requests by adding the `x-mastra-dev-playground` header to the allowed CORS headers list. This resolves the browser error when the playground UI (running on a different port) makes requests to the Mastra dev server.
