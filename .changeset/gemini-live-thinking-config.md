---
'@mastra/voice-google-gemini-live': patch
---

Add `thinkingConfig` to `GeminiLiveVoice` so callers can configure the model's thinking behavior on the Gemini Live session. It is forwarded to the setup frame as `generation_config.thinking_config` (and honored by `updateSessionConfig`). On native-audio thinking models, set `thinkingConfig.includeThoughts: false` to stop the model's reasoning from being spoken as the reply, or bound it with `thinkingBudget`. Default behavior is unchanged when the field is omitted.

```ts
const voice = new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY,
  thinkingConfig: { includeThoughts: false },
});
```
