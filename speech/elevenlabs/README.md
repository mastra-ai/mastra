# ⚠️ DEPRECATED

This package has been deprecated in favor of [@mastra/voice-elevenlabs](https://github.com/mastra-ai/mastra/tree/main/voice/elevenlabs).

## Migration

To migrate to the new package:

1. Install the new package:

```bash
npm install @mastra/voice-elevenlabs
```

2. Update your imports:

```diff
- import { ElevenLabsTTS } from '@mastra/speech-elevenlabs'
+ import { ElevenLabsVoice } from '@mastra/voice-elevenlabs'
```

3. Update your code:

```diff
- const tts = new ElevenLabsTTS({
-   model: {
-     name: 'Adam',
-     apiKey: 'your-api-key'
-   }
- });
+ const voice = new ElevenLabsVoice({
+   speechModel: {
+     name: 'eleven_multilingual_v2',
+     apiKey: 'your-api-key'
+   },
+   speaker: 'Adam'
+ });

- const voices = await tts.voices();
+ const speakers = await voice.getSpeakers();

- const result = await tts.generate({ voice: 'Adam', text: 'Hello' });
+ const stream = await voice.speak('Hello', { speaker: 'Adam' });
```

All functionality remains the same - only the API structure has changed to be more consistent with other voice packages.
