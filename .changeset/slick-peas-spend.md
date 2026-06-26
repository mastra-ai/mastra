---
'@mastra/livekit': minor
---

Add a workflow-driven entrypoint to @mastra/livekit.

You can now generate each voice turn's reply with a Mastra **workflow** instead of an agent. LiveKit still owns the audio loop and calls into Mastra once per turn, so the workflow runs to completion each turn (no suspend/resume) — pass the conversation transcript in and stream the reply out.

**New**

- `workflow` / `workflowInput` options on `createLiveKitWorker()` to drive replies with a workflow
- `createWorkflowReplyGenerator()`: the lower-level workflow generator
- `generate`: an escape hatch to plug in any custom reply generator
- `createAgentReplyGenerator()` and the `VoiceReplyGenerator` / `VoiceTurnContext` types, exposing the per-turn generation seam

```ts
// Drive voice replies with a workflow instead of an agent
export default createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  workflowInput: ({ chatCtx }) => ({ history: chatContextToMessages(chatCtx) }),
  replyStep: 'generateResponse',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});
```

The reply step streams text by piping its agent into the step writer: `await agent.stream(input).textStream.pipeTo(writer)`.
