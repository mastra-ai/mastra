---
'@mastra/code-sdk': minor
---

Added `@mastra/code-sdk/voice/transcribe`, which transcribes audio with any model in the speech-to-text registry, including Mistral Voxtral (`voxtral-mini-latest`), and gives up after one minute if the provider doesn't answer. `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` apply only when the key is the `OPENAI_API_KEY` env key.

```ts
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey } from '@mastra/code-sdk/voice/transcribe';

const entry = resolveSTTModel('mistral');
const apiKey = resolveSTTApiKey(entry.provider);
if (apiKey === undefined) throw new Error('Set MISTRAL_API_KEY');

const transcriber = await createSTTTranscriber(entry, apiKey);
const text = await transcriber.transcribe(audio, 'wav');
```
