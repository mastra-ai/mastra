---
'@mastra/server': minor
---

Fixed Studio reporting models as disconnected when a registered gateway supplies OAuth or stored credentials. Provider responses now include `connectedModels`, and the builder offers only models with available auth. Auth checks have a five-second deadline per provider.

The instructions enhancer checks router models through their own gateway chain. Direct AI SDK instances retain their existing environment checks and fallback order. The `isProviderConnected` and `buildProvidersList` exports remain available from `@mastra/server/handlers/agents`, with `isProviderConnected` keeping its synchronous signature.

Requires `@mastra/core` 1.68.0 or newer, excluding older 1.68.0 prereleases. Fixes #23668.
