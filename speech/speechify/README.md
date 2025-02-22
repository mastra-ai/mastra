# ⚠️ DEPRECATED

This package has been deprecated in favor of [@mastra/voice-speechify](https://github.com/mastra-ai/mastra/tree/main/voice/speechify).

## Migration

To migrate to the new package:

1. Install the new package:

```bash
npm install @mastra/voice-speechify
```

2. Update your imports:

```diff
- import { SpeechifyTTS } from '@mastra/speech-speechify'
+ import { SpeechifyVoice } from '@mastra/voice-speechify'
```

3. Update your code:

```diff
- const tts = new SpeechifyTTS({
-   model: {
-     name: 'simba-multilingual',
-     voice: 'george',
-   }
- });
+ const voice = new SpeechifyVoice({
+   speechModel: {
+     name: 'simba-english',
+   },
+   speaker: 'george'
+ });

- const voices = await tts.voices();
+ const speakers = await voice.getSpeakers();

- const { audioResult } = await tts.generate({ text: 'Hello' });
+ const stream = await voice.speak('Hello');
```
