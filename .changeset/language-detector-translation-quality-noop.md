---
'@mastra/core': patch
---

Deprecated `translationQuality` on `LanguageDetector`, which has no effect.

The option was documented as a translation preference — `'speed'` for fast translation, `'quality'` for accuracy — and offered in the processor provider's configuration schema. The value was stored and never read, so it changed neither the prompt nor any request setting.

The option still type-checks so existing configurations keep working. It no longer appears in the processor provider schema, so configuration UIs stop offering a control that does nothing, and the reference docs now describe it as deprecated.

To trade speed for accuracy, use `providerOptions`, which is passed through to the detection agent:

```ts
new LanguageDetector({
  model,
  targetLanguages: ['English'],
  strategy: 'translate',
  providerOptions: { openai: { reasoningEffort: 'low' } },
});
```
