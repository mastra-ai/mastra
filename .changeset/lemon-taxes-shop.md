---
'@mastra/livekit': minor
---

Added `@mastra/livekit`, a new package that turns Mastra agents into realtime voice agents using LiveKit.

LiveKit's agents framework runs the audio loop — WebRTC transport, voice activity detection, streaming speech-to-text, semantic turn detection, and barge-in — while your Mastra agent generates every reply with its own model, tools, and memory. When a caller interrupts the agent, LiveKit cancels the in-flight stream and Mastra stops generating.

**Build a voice worker**

- `createLiveKitWorker()` builds a LiveKit worker that answers voice sessions with your Mastra agents; `runLiveKitWorker()` starts its CLI (`dev`/`start`).
- `liveKitConnectionRoute()` is an API route that mints LiveKit tokens and dispatches the voice agent into a room; `dispatchVoiceSession()` does the same programmatically for server-initiated sessions like outbound calls.
- `createMastraVoiceAgent()` is the lower-level bridge for custom worker setups.

```ts
// src/mastra/voice-worker.ts
import { createLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});
```

**Drive replies with an agent or a workflow**

Each turn's reply can come from a Mastra agent (the default) or a Mastra workflow. With a workflow, LiveKit still owns the audio loop and calls into Mastra once per turn, so the workflow runs to completion each turn (no suspend/resume) — pass the transcript in, stream the reply out.

- `workflow` / `workflowInput` options on `createLiveKitWorker()` drive replies with a workflow.
- `pipeAgentReplyToWriter(agentStream, writer)` streams an agent's reply from inside a workflow step, forwarding both its words and its tool calls (piping only the text would drop the tool calls).
- `generate` is an escape hatch to plug in any custom reply generator; `createWorkflowReplyGenerator()` and `createAgentReplyGenerator()` expose the per-turn generation seam directly.

```ts
export default createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  workflowInput: ({ messages }) => ({ turn: messages }),
  replyStep: 'generateResponse',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
});
```

**Run work after each turn and at the end of the call**

- `onTurnComplete` runs once per turn, right after the reply finishes playing. It runs in the background — the worker never waits for it — so you can save memory, update your CRM, or record analytics without adding any delay for the caller or the next reply. It also runs with `result.interrupted: true` when the caller talks over the agent.
- `onCallEnd` runs once when the call ends. Unlike `onTurnComplete`, the worker waits for it to finish before exiting, so it's the place for end-of-call work like summarizing the whole conversation into long-term memory once.
- `toolFeedback` speaks a short phrase while a tool runs; `memoryInstance` gives the workflow path a `Memory` instance to open the call's thread and save the greeting, so the saved conversation is complete — greeting included — like the agent path.

Both hooks work whether you drive replies with an agent or a workflow.

```ts
createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  onTurnComplete: async ({ result, memory }) => {
    if (memory) await crm.logContact(memory.resource, result.text);
  },
  onCallEnd: async ({ memory }) => {
    // After the caller hangs up: save a lasting summary of the call.
  },
});
```

**Built-in observability**

When the Mastra instance has observability configured, each call opens a `voice call` trace that nests every turn's agent run and adds child spans for LiveKit's speech-to-text, text-to-speech, turn-detection, and LLM latency, closing with a per-model token, character, and audio usage roll-up. On by default; pass `observability: false` to disable.

**Studio voice mode**

Studio's agent chat gains a voice call mode: when the Mastra server exposes a LiveKit connection route and a voice worker is running, a phone button in the chat composer starts a realtime voice session with the agent. Live captions, agent state (listening, thinking, speaking), and barge-in all surface in the chat, and the conversation lands in the same memory thread as text chat.

See the [LiveKit voice guide](https://mastra.ai/docs/voice/livekit) for setup.
