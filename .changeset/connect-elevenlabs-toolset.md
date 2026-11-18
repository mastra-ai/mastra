---
'@mastra/connect': minor
---

Added an ElevenLabs toolset with 35 tools. Agents can turn text into speech, transcribe audio or video (from base64 audio or a URL), clone voices, compose music from a prompt or an editable composition plan, manage conversational AI agents, voices and voice settings, and pronunciation dictionaries, and read and delete history items, dubbing projects, conversations, and knowledge-base documents.

`elevenlabs_text_to_speech` and `elevenlabs_compose_music` return the audio base64-encoded to your code, while the model only sees a short summary, so audio bytes never fill its context. `elevenlabs_get_user` never returns the account's API key, even though ElevenLabs includes it in the response.

Voice cloning copies a real person's voice, so require approval for it:

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const elevenlabsAgent = new Agent({
  id: 'elevenlabs-agent',
  name: 'ElevenLabs agent',
  instructions: 'Use the connected ElevenLabs tools to narrate messages, transcribe recordings, and score videos.',
  model: 'openai/gpt-5.6',
  tools: tools({ providers: { elevenlabs: { requireApproval: ['elevenlabs_clone_voice'] } } }),
});
```
