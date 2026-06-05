---
'@mastra/core': patch
mastracode: patch
---

Inline resolveModelAuth into ModelRouterLanguageModel and deprecate shared function

- Moved three-tier auth resolution (explicit → gateway.resolveAuth → legacy getApiKey) from standalone `resolveModelAuth` into a private `ModelRouterLanguageModel.resolveAuth` method.
- Deprecated `resolveModelAuth` in `model-auth-resolver.ts` with a JSDoc `@deprecated` tag.
- Fixed `defaultGateways` deduplication in `Mastra` class to use `getGatewayId(gateway)` instead of registry keys.
- Removed no-op `resolveModelId` identity function in mastracode in favor of direct usage.
