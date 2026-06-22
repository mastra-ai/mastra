---
'@mastra/voice-google-gemini-live': minor
---

Added `sendContext()` method to `GeminiLiveVoice` for seeding conversation history into a fresh voice session without triggering a model response. This lets apps replay prior turns from Mastra Memory (or any external store) on a cold connect so the model has full context before the user speaks — enabling seamless handoff between text chat and voice on a shared thread.

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
