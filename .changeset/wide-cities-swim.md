---
'@mastra/voice-hume': minor
---

feat(voice-hume): add realtime speech-to-speech via Hume EVI connect() WebSocket

Added realtime Empathic Voice Interface (EVI) support to HumeVoice. Use `connect()`, `send()`, `answer()`, `close()`, and `on()`/`off()` for bidirectional speech-to-speech over WebSocket.

**Usage:**
```typescript
const voice = new HumeVoice({
  speechModel: { apiKey: process.env.HUME_API_KEY },
  realtimeConfig: { configId: 'your-evi-config-id' },
});
await voice.connect();
voice.on('speaking', ({ audio }) => playBase64Audio(audio));
voice.on('writing', ({ text, role }) => console.log(role, text));
await voice.send(microphoneStream);
await voice.answer({ text: 'Hello!' });
voice.close();
```
