---
'@mastra/voice-speechify': minor
---

Added support for Speechify's Simba 3.2 and Simba 3.0 text-to-speech models. Simba 3.2 is Speechify's latest streaming model with lower latency and richer expressivity, and is the recommended model for English speech.

```typescript
import { SpeechifyVoice } from '@mastra/voice-speechify';

// Set as the default model
const voice = new SpeechifyVoice({
  speechModel: { name: 'simba-3.2' },
});

// Or override per request
const stream = await voice.speak('Hello world', { model: 'simba-3.2' });
```

Note: `simba-3.2` and `simba-3.0` are currently English only. The default model remains `simba-english`.
