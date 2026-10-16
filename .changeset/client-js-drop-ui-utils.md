---
'@mastra/client-js': patch
---

Removed the `@ai-sdk/ui-utils` dependency, which pulled in `@ai-sdk/provider-utils@2.2.8` (GHSA-866g-f22w-33x8, no patched 2.x release). Installing `@mastra/client-js` no longer triggers that security alert. Streaming behavior is unchanged.
