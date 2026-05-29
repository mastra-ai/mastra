---
'@mastra/voice-inworld': minor
---

`@mastra/voice-inworld` now ships `InworldRealtimeVoice` for full-duplex realtime voice — mic in, speakers out, server-side LLM routing, semantic VAD turn-taking, tool calling, barge-in, and live transcripts of both sides — alongside the existing streaming TTS and batch STT. No separate package needed; import both from the same entry point.

```typescript
// Batch TTS / STT (unchanged)
import { InworldVoice } from '@mastra/voice-inworld';

// New: realtime full-duplex voice, from the same package
import { InworldRealtimeVoice } from '@mastra/voice-inworld';

const voice = new InworldRealtimeVoice({
  apiKey: process.env.INWORLD_API_KEY,
  // Defaults: model 'inworld/models/gemma-4-26b-a4b-it', speaker 'Sarah',
  // STT 'inworld/inworld-stt-1', semantic-VAD turn detection.
});

await voice.connect();
voice.on('speaker', stream => playAudio(stream)); // PCM16 @ 24kHz
voice.on('writing', ({ text, role }) => console.log(role, text));
voice.on('interrupted', ({ response_id }) => stopAudio(response_id));
await voice.send(getMicrophoneStream());
```
