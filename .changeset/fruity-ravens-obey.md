---
'@mastra/livekit': patch
---

Raised the supported LiveKit Agents and plugin minimum to 1.7.1 so speech flushing and playback outcome APIs are available. **Before:** The peer range `^1.4.0` accepted Agents 1.4–1.6. **After:** The minimum is `1.7.1`. Upgrade Agents and any installed LiveKit or Silero plugins to matching versions:

```sh
npm install @livekit/agents@1.7.1 @livekit/agents-plugin-livekit@1.7.1 @livekit/agents-plugin-silero@1.7.1
```

Existing session setup can stay in place. Attach the playback observer before starting the session:

```ts
import { voice } from '@livekit/agents';
import { observeVoiceSession } from '@mastra/livekit/plugin';

const session = new voice.AgentSession();
observeVoiceSession(session, {
  onSpeechComplete: result => console.log(result.outcome),
});
```
