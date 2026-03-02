---
'@mastra/voice-hume': minor
---

HumeVoice now provides realtime empathic speech-to-speech, letting apps stream audio and receive emotion-aware synthesized responses over a live connection.

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
