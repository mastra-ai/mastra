---
'@mastra/ai-sdk': patch
---

Fixed `handleChatStream` not merging `providerOptions` from `params` and `defaultOptions`. Previously, `params.providerOptions` would completely replace `defaultOptions.providerOptions` instead of merging them. Now provider-specific keys from both sources are merged, with `params.providerOptions` taking precedence for the same provider.
