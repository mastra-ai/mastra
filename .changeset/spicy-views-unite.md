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
