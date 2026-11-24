---
'@mastra/core': patch
---

Improved `@mastra/core` startup time. The built-in provider registry is now filtered once per set of enabled gateways instead of on every lookup, which removes about 600 redundant passes over the registry while the package loads. Provider lists still update when a custom gateway is registered or when a gateway is enabled or disabled (for example by setting `MASTRA_GATEWAY_API_KEY`).
