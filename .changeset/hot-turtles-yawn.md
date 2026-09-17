---
'@mastra/server': patch
---

Fixed Studio reporting providers as disconnected when a registered gateway supplies OAuth or stored credentials. The provider catalog uses the optional gateway credential-presence method, without resolving authentication for each model or refreshing tokens. Gateways without this method retain environment-variable detection.

The instructions enhancer checks router models through their own gateway chain. Direct AI SDK instances retain their existing environment checks and fallback order. The `isProviderConnected` and `buildProvidersList` exports remain available from `@mastra/server/handlers/agents`, with `isProviderConnected` keeping its synchronous signature.

Requires `@mastra/core` 1.68.0 or newer, excluding older 1.68.0 prereleases. Fixes #23668.
