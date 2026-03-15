---
'@mastra/voice-camb': minor
---

Added Camb AI voice integration package (@mastra/voice-camb) for text-to-speech capabilities. Supports mars-flash, mars-pro, and mars-instruct models with configurable voice selection, language settings, and style instructions.

```ts
import { CambVoice } from '@mastra/voice-camb';

const voice = new CambVoice({
  speechModel: { name: 'mars-pro' },
});

const audioStream = await voice.speak('Hello from Camb AI!');
```
