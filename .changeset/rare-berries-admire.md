---
'@mastra/core': patch
---

Fixed `Property '#private' is missing` when passing a voice provider such as `new OpenAIRealtimeVoice()` to an agent's `voice` option or to `CompositeVoice` ([#29016](https://github.com/mastra-ai/mastra/issues/29016)).

These options now accept the `IMastraVoice` interface, exported from `@mastra/core/voice`. `agent.voice` and `agent.getVoice()` return `IMastraVoice`. If you annotate a variable with a voice type, use `IMastraVoice` instead of `MastraVoice`.

```typescript
import { Agent } from '@mastra/core/agent';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';

export const voiceAgent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: 'You are a voice assistant.',
  model: 'openai/gpt-6.1-sol',
  voice: new OpenAIRealtimeVoice(), // failed with TS2322 before this fix
});
```
