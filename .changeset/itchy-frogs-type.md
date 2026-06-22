---
'@mastra/voice-google-gemini-live': minor
---

Added `sendContext()` method to `GeminiLiveVoice` for seeding conversation history into a live session without triggering a model response. This maps to Gemini Live's `client_content` frame with `turnComplete: false`, letting apps replay prior turns (e.g. from Mastra Memory) on a cold connect so the model has context before the user speaks.

**Usage:**

```ts
await voice.connect();

await voice.sendContext([
  { role: 'user', content: 'What is the weather?' },
  { role: 'assistant', content: 'It is 72°F in San Francisco.' },
]);

// Model stays silent until the user actually speaks
await voice.send(micStream);
```
