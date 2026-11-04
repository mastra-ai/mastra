---
'@mastra/code-sdk': patch
---

Added `@mastra/code-sdk/voice/transcribe`, which transcribes audio with any model in the speech-to-text registry, including Mistral Voxtral (`voxtral-mini-latest`).

```ts
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey } from '@mastra/code-sdk/voice/transcribe';

const entry = resolveSTTModel('mistral');
const transcriber = await createSTTTranscriber(entry, resolveSTTApiKey(entry.provider)!);
const text = await transcriber.transcribe(audio, 'wav');
```
