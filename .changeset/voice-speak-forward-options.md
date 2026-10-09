---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed `voice.speak()` in the Client SDK ignoring the selected speaker and other options. The speak endpoint now forwards `options` (including `speaker`) to the agent's voice provider, so the requested voice is used instead of the provider default. The top-level `speakerId` field still works; if both are sent, `options.speaker` takes precedence.

```ts
await client.getAgent('my-agent').voice.speak('Hello', { speaker: 'nova', speed: 1.2 });
```
