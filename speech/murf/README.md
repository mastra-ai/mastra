# ⚠️ DEPRECATED

This package has been deprecated in favor of [@mastra/voice-murf](https://github.com/mastra-ai/mastra/tree/main/voice/murf).

## Migration

To migrate to the new package:

1. Install the new package:

```bash
npm install @mastra/voice-murf
```

2. Update your imports:

```diff
- import { MurfTTS } from '@mastra/speech-murf'
+ import { MurfVoice } from '@mastra/voice-murf'
```

3. Update your code:

```diff
- const tts = new MurfTTS({
-   model: {
-     name: 'GEN2',
-     voice: 'en-US-natalie',
-   }
- });
+ const voice = new MurfVoice({
+   speechModel: {
+     name: 'GEN2',
+   },
+   speaker: 'en-US-natalie'
+ });

- const voices = await tts.voices();
+ const speakers = await voice.getSpeakers();

- const { audioResult } = await tts.generate({ text: 'Hello' });
+ const stream = await voice.speak('Hello');
```
