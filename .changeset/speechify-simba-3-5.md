---
'@mastra/voice-speechify': minor
---

Default to Speechify's Simba 3.5 and move to the `@speechify/api` SDK.

`simba-3.5` is Speechify's recommended model: 48 languages on one id, and every catalog voice, cloned voices included, speaks all of them. Pass `language` to choose one; without it the voice's own locale decides. `simba-3.2` and `simba-3.0` stay selectable. `simba-english` and `simba-multilingual` are retired for new workspaces and are served by `simba-3.2` and `simba-3.5` from 2026-11-21.

```typescript
import { SpeechifyVoice } from '@mastra/voice-speechify';

const voice = new SpeechifyVoice(); // simba-3.5 with the harper_32 voice

await voice.speak('Olá, mundo', { language: 'pt-BR' });
```

- The deprecated `@speechify/api-sdk` is replaced by `@speechify/api`. The `speak()` options are `speaker`, `model`, `language`, `audioFormat` (`mp3`, `ogg`, `aac` or `pcm`), `outputFormat` and `options`; `options` keys now follow the API's snake_case, such as `loudness_normalization`.
- `getSpeakers()` reads Speechify's catalog live and reports each voice's name, locale, gender and the models that render it. The bundled voice list is gone: most of its ids no longer existed, and it was missing over nine hundred current voices. `speaker` accepts any catalog id.
- Requests carry `Speechify-Caller: mastra` and the package version, so Speechify can warn before a model change reaches Mastra users.
