---
'@mastra/livekit': patch
---

`@mastra/livekit/worker` now exports `MastraVoiceAgent` and `createMastraVoiceAgent` (with the `MastraVoiceAgentOptions` and `MastraStreamOptions` types). This is the `voice.Agent` subclass `createLiveKitWorker()` builds per session, so you can construct it yourself when you own the `voice.AgentSession` — for example to test a Mastra-backed agent with `@livekit/agents`' `voice.testing` harness without speech-to-text, text-to-speech, or a running worker.

```ts
import { initializeLogger, voice } from '@livekit/agents';
import { createMastraVoiceAgent } from '@mastra/livekit/worker';

initializeLogger({ level: 'silent', pretty: false }); // required outside a LiveKit worker

const session = new voice.AgentSession();
await session.start({ agent: createMastraVoiceAgent({ agent: supportAgent, memory: false }) });

const result = session.run({ userInput: 'What are your opening hours?' });
await result.wait();
result.expect.nextEvent().isMessage({ role: 'assistant' });
```
