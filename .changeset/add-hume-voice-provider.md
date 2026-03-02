---
'@mastra/voice-hume': minor
---

feat(voice-hume): add Hume as a new voice provider with TTS support

Add Hume as a voice provider for Mastra, enabling expressive text-to-speech via Hume's Octave TTS API. Hume does not support speech-to-text; use `CompositeVoice` with Deepgram or another provider for full voice capabilities.

**Usage:**
```typescript
import { HumeVoice } from '@mastra/voice-hume';

const voice = new HumeVoice({
  speechModel: { apiKey: process.env.HUME_API_KEY },
  speaker: 'your-voice-name',
});

const audioStream = await voice.speak('Hello world');
```
