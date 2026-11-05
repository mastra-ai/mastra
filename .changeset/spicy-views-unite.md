---
'@mastra/code-sdk': minor
---

Speech-to-text registry entries can now name a `realtimeModel` for live transcription. Mistral Voxtral sets it; other providers leave it undefined and stay on recorded clips.

```ts
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';

const { model, realtimeModel } = resolveSTTModel('mistral');
// model: 'voxtral-mini-latest'
// realtimeModel: 'voxtral-mini-transcribe-realtime-3'
```

Speech-to-text calls now give up after one minute and retry at most once, instead of waiting up to ten minutes with two retries. A stored OpenAI key no longer sends the server's `OPENAI_ORG_ID` or `OPENAI_PROJECT_ID`; only the `OPENAI_API_KEY` env key keeps them.
