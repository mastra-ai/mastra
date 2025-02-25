# @mastra/speech-google (DEPRECATED)

⚠️ **This package is deprecated.** Please use [@mastra/voice-google](https://www.npmjs.com/package/@mastra/voice-google) instead.

## Migration

1. Install the new package:

```bash
npm install @mastra/voice-google
```

2. Update your imports:

```typescript
// Old
import { GoogleTTS } from '@mastra/speech-google';
// New
import { GoogleVoice } from '@mastra/voice-google';
```

3. Update initialization:

```typescript
// Old
const tts = new GoogleTTS({
  model: {
    name: 'en-US-Standard-C',
    apiKey: 'your-api-key',
  },
});

// New
const voice = new GoogleVoice({
  speechModel: {
    apiKey: 'your-api-key',
  },
  speaker: 'en-US-Standard-C',
});
```

The new package combines both speech synthesis and recognition capabilities.
