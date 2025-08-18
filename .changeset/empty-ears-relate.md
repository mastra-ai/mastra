---
'@mastra/core': patch
---

Fix provider metadata preservation during V5 message conversions

Provider metadata (providerMetadata and callProviderMetadata) is now properly preserved when converting messages between AI SDK V5 and internal V2 formats. This ensures provider-specific information isn't lost during message transformations.
