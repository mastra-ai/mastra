# @mastra/speech-openai (DEPRECATED)

⚠️ **This package is deprecated.** Please use [@mastra/voice-openai](https://github.com/mastra-ai/mastra/tree/main/voice/openai) instead.

## Migration

The new package `@mastra/voice-openai` provides both Text-to-Speech and Speech-to-Text capabilities. To migrate:

1. Install the new package:

```bash
npm uninstall @mastra/speech-openai
npm install @mastra/voice-openai
```

2. Update your imports:

```typescript
// Old
import { OpenAITTS } from '@mastra/speech-openai';
// New
import { OpenAIVoice } from '@mastra/voice-openai';
```

For detailed migration instructions and new features, please refer to the [@mastra/voice-openai documentation](https://github.com/mastra-ai/mastra/tree/main/voice/openai).
