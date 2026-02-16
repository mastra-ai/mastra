---
'@mastra/core': patch
---

Add User-Agent header for Anthropic API calls

Added a `getUserAgentHeader()` helper in gateway constants that returns a `User-Agent` header with the package name and version. This header is now included in Anthropic API requests made through the models-dev and netlify gateways, enabling better request attribution and debugging.
