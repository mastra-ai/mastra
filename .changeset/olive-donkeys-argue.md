---
'@mastra/voice-smallest': minor
---

Added `@mastra/voice-smallest`, a voice provider backed by Smallest AI's Waves Lightning text-to-speech and Pulse speech-to-text models. Voices are resolved at runtime through `getSpeakers()` rather than pinned in the package, and `language: 'auto'` lets a single Indian-accent voice code-switch between English and Hindi.

```typescript
import { createReadStream } from 'node:fs';
import { SmallestVoice } from '@mastra/voice-smallest';

const voice = new SmallestVoice({ speaker: 'meher' });

const audio = await voice.speak('Hello from Mastra!');
const transcript = await voice.listen(createReadStream('./audio.wav'));
```
