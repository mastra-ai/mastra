---
'@mastra/core': patch
---

Deprecated `translationQuality` on `LanguageDetector`. The option previously selected prompt-level "Quality Level" guidance, but that behavior was removed when the language detection and translation prompts were streamlined. The option currently has no effect.

Existing configurations keep working and keep type-checking. The option no longer appears in the processor provider's configuration schema, so configuration UIs stop offering a control that does nothing, and the reference docs now mark it as deprecated.

For model-specific speed and quality controls, use `providerOptions` when your provider supports them:

```ts
new LanguageDetector({
  model,
  targetLanguages: ['English'],
  strategy: 'translate',
  providerOptions: { openai: { reasoningEffort: 'low' } },
});
```
