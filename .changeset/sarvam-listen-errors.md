---
'@mastra/voice-sarvam': patch
---

`SarvamVoice.listen()` now throws on Sarvam API errors (e.g. invalid API key, rate limits) instead of silently returning `undefined`. Error messages for both `listen()` and `speak()` now surface Sarvam's `error.message`.

Before, a failed `listen()` call returned `undefined`. Now it throws, so handle it with `try`/`catch`:

```ts
try {
  const text = await voice.listen(audio);
} catch (error) {
  // error.message: "Sarvam AI API Error: <message>"
}
```
