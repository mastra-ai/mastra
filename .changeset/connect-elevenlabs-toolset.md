---
'@mastra/connect': minor
---

Added an ElevenLabs toolset with 29 tools. Agents can manage conversational AI agents, voices and voice settings, and pronunciation dictionaries, and read and delete history items, dubbing projects, conversations, and knowledge-base documents. `elevenlabs_get_user` never returns the account's API key, even though ElevenLabs includes it in the response.

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const elevenlabsAgent = new Agent({
  id: 'elevenlabs-agent',
  name: 'ElevenLabs agent',
  instructions: 'Use the connected ElevenLabs tools to manage voice agents and voices.',
  model: 'openai/gpt-5.6',
  tools: tools({ providers: ['elevenlabs'] }),
});
```
