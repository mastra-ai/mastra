---
'@mastra/voice-elevenlabs': minor
---

Add output format support to ElevenLabs voice integration

The `speak()` method now supports specifying audio output formats via the `outputFormat` option. This enables telephony and VoIP use cases that require specific audio formats like μ-law (ulaw_8000) or PCM formats.

```typescript
import { ElevenLabsVoice } from '@mastra/voice-elevenlabs';

const voice = new ElevenLabsVoice();

// Generate speech with telephony format (μ-law 8kHz)
const stream = await voice.speak('Hello from Mastra!', {
  outputFormat: 'ulaw_8000',
});

// Generate speech with PCM format
const pcmStream = await voice.speak('Hello from Mastra!', {
  outputFormat: 'pcm_16000',
});
```

Supported formats include:
- MP3 variants: `mp3_22050_32`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`
- PCM variants: `pcm_8000`, `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100`
- Telephony formats: `ulaw_8000`, `alaw_8000` (μ-law and A-law 8kHz for VoIP/telephony)
- WAV formats: `wav`, `wav_8000`, `wav_16000`

If `outputFormat` is not specified, the method defaults to ElevenLabs' default format (typically `mp3_44100_128`).

