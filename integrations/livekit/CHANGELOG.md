# @mastra/livekit

## 0.2.0

### Minor Changes

- Added `@mastra/livekit`, a new package that turns Mastra agents into realtime voice agents using LiveKit. ([#17896](https://github.com/mastra-ai/mastra/pull/17896))

  LiveKit's agents framework runs the audio loop — WebRTC transport, voice activity detection, streaming speech-to-text, semantic turn detection, and barge-in — while your Mastra agent generates every reply with its own model, tools, and memory. When a caller interrupts the agent, LiveKit cancels the in-flight stream and Mastra stops generating.

  **Build a voice worker**
  - `createLiveKitWorker()` builds a LiveKit worker that answers voice sessions with your Mastra agents; `runLiveKitWorker()` starts its CLI (`dev`/`start`). Both live on the `@mastra/livekit/worker` entry point.
  - `liveKitConnectionRoute()` is an API route that mints LiveKit tokens and dispatches the voice agent into a room; `dispatchVoiceSession()` does the same programmatically for server-initiated sessions like outbound calls. These live on the `@mastra/livekit` entry point, which is safe to import from Mastra server code — it never loads the LiveKit agents runtime.

  ```ts
  // src/mastra/voice-worker.ts
  import { createLiveKitWorker } from '@mastra/livekit/worker';
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
  - `generate` is an escape hatch to plug in any custom reply generator.

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

### Patch Changes

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0

## 0.2.0-alpha.0

### Minor Changes

- Added `@mastra/livekit`, a new package that turns Mastra agents into realtime voice agents using LiveKit. ([#17896](https://github.com/mastra-ai/mastra/pull/17896))

  LiveKit's agents framework runs the audio loop — WebRTC transport, voice activity detection, streaming speech-to-text, semantic turn detection, and barge-in — while your Mastra agent generates every reply with its own model, tools, and memory. When a caller interrupts the agent, LiveKit cancels the in-flight stream and Mastra stops generating.

  **Build a voice worker**
  - `createLiveKitWorker()` builds a LiveKit worker that answers voice sessions with your Mastra agents; `runLiveKitWorker()` starts its CLI (`dev`/`start`). Both live on the `@mastra/livekit/worker` entry point.
  - `liveKitConnectionRoute()` is an API route that mints LiveKit tokens and dispatches the voice agent into a room; `dispatchVoiceSession()` does the same programmatically for server-initiated sessions like outbound calls. These live on the `@mastra/livekit` entry point, which is safe to import from Mastra server code — it never loads the LiveKit agents runtime.

  ```ts
  // src/mastra/voice-worker.ts
  import { createLiveKitWorker } from '@mastra/livekit/worker';
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
  - `generate` is an escape hatch to plug in any custom reply generator.

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

### Patch Changes

- Updated dependencies [[`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36)]:
  - @mastra/core@1.50.0-alpha.5
