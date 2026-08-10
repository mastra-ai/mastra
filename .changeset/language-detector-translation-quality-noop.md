---
'@mastra/core': patch
---

Deprecated `translationQuality` on `LanguageDetector`. Setting it never changed how content was detected or translated.

Existing configurations keep working and keep type-checking. The option no longer appears in the processor provider's configuration schema, so configuration UIs stop offering a control that does nothing, and the reference docs now mark it as deprecated.

To trade speed for accuracy, use `providerOptions`, which reaches the detection agent:

```ts
new LanguageDetector({
  model,
  targetLanguages: ['English'],
  strategy: 'translate',
  providerOptions: { openai: { reasoningEffort: 'low' } },
});
```
