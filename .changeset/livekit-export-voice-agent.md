---
'@mastra/livekit': patch
---

`@mastra/livekit/worker` now exports `MastraVoiceAgent` and `createMastraVoiceAgent` (with the `MastraVoiceAgentOptions` and `MastraStreamOptions` types). This is the `voice.Agent` subclass `createLiveKitWorker()` builds per session, so you can construct it yourself when you own the `voice.AgentSession` — for example to test a Mastra-backed agent with `@livekit/agents`' `voice.testing` harness without speech-to-text, text-to-speech, or a running worker.
