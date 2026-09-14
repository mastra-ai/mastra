---
'@mastra/code-sdk': patch
---

Kimi For Coding models now report `kimi-for-coding` as their provider (instead of `anthropic.messages`) so message history compatibility can tell Kimi turns apart from Anthropic turns when a thread switches between them. Anything that persisted or branched on the provider string should switch to the new value:

```ts
// Before
if (model.provider === 'anthropic.messages') { /* could be Kimi or Claude */ }

// After
if (model.provider === 'kimi-for-coding') { /* Kimi For Coding */ }
```
