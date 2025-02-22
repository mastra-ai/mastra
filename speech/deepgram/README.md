# @mastra/speech-deepgram (DEPRECATED)

⚠️ **This package is deprecated.** Please use [@mastra/voice-deepgram](https://github.com/mastra-ai/mastra/tree/main/voice/deepgram) instead.

## Migration

The new package `@mastra/voice-deepgram` provides both Text-to-Speech and Speech-to-Text capabilities. To migrate:

1. Install the new package:

```bash
npm uninstall @mastra/speech-deepgram
npm install @mastra/voice-deepgram
```

2. Update your imports:

```typescript
// Old
import { DeepgramTTS } from '@mastra/speech-deepgram';
// New
import { DeepgramVoice } from '@mastra/voice-deepgram';
```

For detailed migration instructions and new features, please refer to the [@mastra/voice-deepgram documentation](https://github.com/mastra-ai/mastra/tree/main/voice/deepgram).
