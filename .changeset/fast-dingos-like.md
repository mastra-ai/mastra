---
'@mastra/voice-speechify': patch
---

Fixed voice selection for the Simba 3 models. Speechify's `simba-3.2` and `simba-3.0` serve a curated voice set only (`beatrice_32`, `dominic_32`, `edmund_32`, `geffen_32`, `harper_32`, `hugh_32`, `imogen_32`, `wyatt_32`), so pairing them with a classic catalog voice like `george` failed with an API error.

- Added the curated Simba 3 voices to the voice list, so they type-check as `speaker` and appear in `getSpeakers()`
- The default speaker now follows the configured model: `harper_32` for Simba 3 models, `george` otherwise

```typescript
import { SpeechifyVoice } from '@mastra/voice-speechify';

// Works out of the box now — defaults to the harper_32 voice
const voice = new SpeechifyVoice({
  speechModel: { name: 'simba-3.2' },
});

// Or pick a curated voice explicitly
new SpeechifyVoice({
  speechModel: { name: 'simba-3.2' },
  speaker: 'imogen_32',
});
```

When overriding the model per request, pass a matching speaker too: `voice.speak('Hi', { model: 'simba-3.2', speaker: 'harper_32' })`.
