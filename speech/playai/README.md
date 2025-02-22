# ⚠️ DEPRECATED

This package has been deprecated in favor of [@mastra/voice-playai](https://github.com/mastra-ai/mastra/tree/main/voice/playai).

## Migration

To migrate to the new package:

1. Install the new package:

```bash
npm install @mastra/voice-playai
```

2. Update your imports:

```diff
- import { PlayAITTS } from '@mastra/speech-playai'
+ import { PlayAIVoice } from '@mastra/voice-playai'
```

3. Update your code:

```diff
- const tts = new PlayAITTS({
-   model: {
-     name: 'PlayDialog',
-     voice: 'angelo',
-   }
- });
+ const voice = new PlayAIVoice({
+   speechModel: {
+     name: 'PlayDialog',
+   },
+   speaker: 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json'
+ });

- const voices = await tts.voices();
+ const speakers = await voice.getSpeakers();

- const { audioResult } = await tts.generate({ text: 'Hello' });
+ const stream = await voice.speak('Hello');
```

All functionality remains the same - only the API structure has changed to be more consistent with other voice packages.

## Installation

```bash
npm install @mastra/speech-playai
```

## Configuration

The module requires the following environment variable:

```bash
PLAYAI_API_KEY=your_api_key
```

## Usage

```typescript
import { PlayAITTS } from '@mastra/speech-playai';

// Initialize with configuration
const tts = new PlayAITTS({
  model: {
    name: 'en-US-1', // Default voice
    apiKey: 'your-api-key', // Optional, can use PLAYAI_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'en-US-1',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'en-US-1',
  text: 'Hello from Mastra!',
});
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support
- Natural and expressive speech output
- Voice customization options

## Voice Options

PlayAI offers a selection of voices with different characteristics:

- en-US-1 (Male, American)
- en-US-2 (Female, American)
- en-GB-1 (Male, British)
- en-GB-2 (Female, British)
- en-AU-1 (Male, Australian)
- en-AU-2 (Female, Australian)

View the complete list in the `voices.ts` file or PlayAI's documentation.

## Additional Features

- Voice style customization
- Emotion control
- Speech rate adjustment
- Pitch modification
- Custom pronunciation support
