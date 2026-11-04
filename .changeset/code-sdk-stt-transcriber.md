---
'@mastra/code-sdk': minor
---

Added `@mastra/code-sdk/voice/transcribe`, which transcribes audio with any model in the speech-to-text registry, including Mistral Voxtral (`voxtral-mini-latest`).

```ts
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey } from '@mastra/code-sdk/voice/transcribe';

const entry = resolveSTTModel('mistral');
const apiKey = resolveSTTApiKey(entry.provider);
if (apiKey === undefined) throw new Error('Set MISTRAL_API_KEY');

const transcriber = await createSTTTranscriber(entry, apiKey);
const text = await transcriber.transcribe(audio, 'wav');
```
