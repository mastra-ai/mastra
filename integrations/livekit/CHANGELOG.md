# @mastra/livekit

## 0.3.0

### Minor Changes

- Added per-call speech-to-text and text-to-speech selection to `createLiveKitWorker`. Set the new `configuration.stt` and `configuration.tts` resolvers to pick the transcriber and voice for each call — one voice or language per tenant — keyed off the dispatch metadata and request context. Each resolver runs once per call and falls back to the top-level `stt` / `tts` option when it returns `undefined`. ([#19136](https://github.com/mastra-ai/mastra/pull/19136))

  ```ts
  export default createLiveKitWorker({
    mastra,
    agent: 'support',
    stt: 'deepgram/nova-3',
    tts: 'cartesia/sonic-3', // fallback voice
    configuration: {
      // Give each tenant its own voice, resolved per call from the dispatch metadata.
      tts: ({ requestContext }) => tenantVoices[requestContext?.tenant as string],
    },
  });
  ```

  Previously the worker's speech pipeline was fixed at construction, so a multi-tenant worker could not vary voices or transcription per call. Customers who own their LiveKit session (the `MastraLLM` plugin path) already choose STT/TTS per call by construction; this brings the same flexibility to the batteries-included worker.

- Added `MastraLLM`, a standard LiveKit LLM plugin, on the new `@mastra/livekit/plugin` entry point. Build your own `voice.AgentSession` and put a Mastra agent in the `llm` slot — the agent loop, tools, and memory run on a remote Mastra server reached over HTTP, so the worker process needs no Mastra app, database, or model provider keys. ([#19136](https://github.com/mastra-ai/mastra/pull/19136))

  Before, the worker wrapper always owned the LiveKit session:

  ```ts
  import { createLiveKitWorker } from '@mastra/livekit/worker';
  import { mastra } from './index';

  export default createLiveKitWorker({
    mastra,
    agent: 'support',
    stt: 'deepgram/nova-3',
    tts: 'cartesia/sonic-3',
  });
  ```

  Now you can own the session and keep Mastra as the LLM component:

  ```ts
  import { voice } from '@livekit/agents';
  import { MastraLLM } from '@mastra/livekit/plugin';

  const session = new voice.AgentSession({
    llm: new MastraLLM({
      remote: { baseUrl: process.env.MASTRA_URL!, agentId: 'support' },
      memory: { thread: callId, resource: userId },
    }),
    stt: 'deepgram/nova-3',
    tts: 'cartesia/sonic-3',
    // Required with `memory`: LiveKit enables preemptive generation by default.
    turnHandling: { preemptiveGeneration: { enabled: false } },
  });
  ```

  `createLiveKitWorker` stays the batteries-included path; the plugin is the composable one. Tools keep running server-side on the Mastra agent, and interrupting the agent aborts the server-side generation.

  **New transport and helpers**
  - Added `createRemoteAgentReplyGenerator()`: streams replies from a remote Mastra server over HTTP with per-turn abort, LiveKit-typed errors, and a connect + first-token timeout. It also plugs into `createLiveKitWorker`'s `generate` option to run the existing worker against a remote server.
  - Promoted `speakGreeting()`, `waitForAgentDoneSpeaking()`, and `runEndCall()` to public exports of `@mastra/livekit/worker`, so a worker that owns its session can rebuild the greeting and agent-initiated hang-up patterns in a few lines.

  **Improvements to the existing worker**
  - Interrupted turns now self-heal: when a caller interrupts a reply, nothing is persisted at that moment, and the part the caller actually heard is backfilled into the memory thread on the next turn — so saved transcripts match the call.
  - Added an `onToolCall` hook that fires as each tool call starts mid-reply, the building block for tool-driven side effects such as analytics or hang-up.
  - `onTurnComplete` now receives the turn's token usage as `result.usage`.

- Added a `configuration` option to `createLiveKitWorker` — one grouped home for conversation and compliance controls, so these don't each become a separate top-level worker option. It ships with greeting/AI-disclosure controls, a consent model, and agent-initiated hang-up, and is where further compliance controls will land. ([#19136](https://github.com/mastra-ai/mastra/pull/19136))

  **Greeting and AI disclosure**

  `configuration.greeting` controls the opening line spoken at call start. Set `allowInterruptions: false` so a legally-required AI disclosure plays through and can't be talked over (EU AI Act Art. 50), `awaitPlayout: true` to hold post-greeting work until it finishes, and `repeatEvery` to re-disclose periodically on long calls (spoken at the next turn boundary, never mid-sentence).

  ```ts
  createLiveKitWorker({
    mastra,
    agent: 'support',
    configuration: {
      greeting: {
        text: 'You are speaking with an AI assistant. This call may be recorded. How can I help?',
        allowInterruptions: false,
        awaitPlayout: true,
        repeatEvery: 3 * 60_000, // re-disclose ~every 3 minutes
      },
    },
  });
  ```

  **Per-tenant greeting**

  `greeting.text` also accepts a resolver, called once per call with the call context, so one multi-tenant agent can open differently per tenant based on the dispatch metadata:

  ```ts
  greeting: {
    text: ({ metadata }) => `Thanks for calling ${tenantName(metadata)}. You're speaking with an AI assistant.`,
    allowInterruptions: false,
  }
  ```

  **Consent**

  `configuration.consentPolicy` declares which data-use consents a call needs, as a named, extensible set (starting with `summaryStorage`) rather than one global flag. Declaring the policy enforces nothing by itself: the new `createConsentTool` captures the caller's decision at runtime — add it to your agent and it hands each decision to your own store — and your code enforces the requirement at `onCallEnd` (or before any consent-gated step).

  ```ts
  import { createConsentTool } from '@mastra/livekit';

  // in your agent's tools:
  recordConsent: createConsentTool({
    items: ['summaryStorage'],
    onGrant: async ({ item, granted, resourceId }) => {
      if (resourceId) await db.saveConsent(resourceId, item, granted);
    },
  }),
  ```

  **Agent-initiated hang-up**

  `configuration.endCall` lets the agent end the call itself. Add the new `createEndCallTool` to your agent and instruct it to say goodbye and then call the tool; the worker waits for the closing words to finish playing, holds a short audio drain (`drainMs`, default 800ms) so the tail of the goodbye isn't clipped while it's still buffered at the caller, then hangs up — running `onCallEnd` on the way out, exactly as a caller hang-up does. It works on both the agent and workflow reply paths.

  ```ts
  import { createEndCallTool } from '@mastra/livekit';

  // in your agent's tools:
  endCall: (createEndCallTool(),
    // on the worker:
    createLiveKitWorker({ mastra, agent: 'support', configuration: { endCall: {} } }));
  ```

  **Backwards compatible**

  The previous top-level `greeting` (string) and `persistGreeting` options still work as deprecated aliases for `configuration.greeting.text` and `configuration.greeting.persist`. When both are set, `configuration.greeting` wins field by field, so existing worker configs keep running unchanged.

### Patch Changes

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.3.0-alpha.0

### Minor Changes

- Added per-call speech-to-text and text-to-speech selection to `createLiveKitWorker`. Set the new `configuration.stt` and `configuration.tts` resolvers to pick the transcriber and voice for each call — one voice or language per tenant — keyed off the dispatch metadata and request context. Each resolver runs once per call and falls back to the top-level `stt` / `tts` option when it returns `undefined`. ([#19136](https://github.com/mastra-ai/mastra/pull/19136))

  ```ts
  export default createLiveKitWorker({
    mastra,
    agent: 'support',
    stt: 'deepgram/nova-3',
    tts: 'cartesia/sonic-3', // fallback voice
    configuration: {
      // Give each tenant its own voice, resolved per call from the dispatch metadata.
      tts: ({ requestContext }) => tenantVoices[requestContext?.tenant as string],
    },
  });
  ```

  Previously the worker's speech pipeline was fixed at construction, so a multi-tenant worker could not vary voices or transcription per call. Customers who own their LiveKit session (the `MastraLLM` plugin path) already choose STT/TTS per call by construction; this brings the same flexibility to the batteries-included worker.

- Added `MastraLLM`, a standard LiveKit LLM plugin, on the new `@mastra/livekit/plugin` entry point. Build your own `voice.AgentSession` and put a Mastra agent in the `llm` slot — the agent loop, tools, and memory run on a remote Mastra server reached over HTTP, so the worker process needs no Mastra app, database, or model provider keys. ([#19136](https://github.com/mastra-ai/mastra/pull/19136))

  Before, the worker wrapper always owned the LiveKit session:

  ```ts
  import { createLiveKitWorker } from '@mastra/livekit/worker';
  import { mastra } from './index';

  export default createLiveKitWorker({
    mastra,
    agent: 'support',
    stt: 'deepgram/nova-3',
    tts: 'cartesia/sonic-3',
  });
  ```

  Now you can own the session and keep Mastra as the LLM component:

  ```ts
  import { voice } from '@livekit/agents';
  import { MastraLLM } from '@mastra/livekit/plugin';

  const session = new voice.AgentSession({
    llm: new MastraLLM({
      remote: { baseUrl: process.env.MASTRA_URL!, agentId: 'support' },
      memory: { thread: callId, resource: userId },
    }),
    stt: 'deepgram/nova-3',
    tts: 'cartesia/sonic-3',
    // Required with `memory`: LiveKit enables preemptive generation by default.
    turnHandling: { preemptiveGeneration: { enabled: false } },
  });
  ```

  `createLiveKitWorker` stays the batteries-included path; the plugin is the composable one. Tools keep running server-side on the Mastra agent, and interrupting the agent aborts the server-side generation.

  **New transport and helpers**
  - Added `createRemoteAgentReplyGenerator()`: streams replies from a remote Mastra server over HTTP with per-turn abort, LiveKit-typed errors, and a connect + first-token timeout. It also plugs into `createLiveKitWorker`'s `generate` option to run the existing worker against a remote server.
  - Promoted `speakGreeting()`, `waitForAgentDoneSpeaking()`, and `runEndCall()` to public exports of `@mastra/livekit/worker`, so a worker that owns its session can rebuild the greeting and agent-initiated hang-up patterns in a few lines.

  **Improvements to the existing worker**
  - Interrupted turns now self-heal: when a caller interrupts a reply, nothing is persisted at that moment, and the part the caller actually heard is backfilled into the memory thread on the next turn — so saved transcripts match the call.
  - Added an `onToolCall` hook that fires as each tool call starts mid-reply, the building block for tool-driven side effects such as analytics or hang-up.
  - `onTurnComplete` now receives the turn's token usage as `result.usage`.

- Added a `configuration` option to `createLiveKitWorker` — one grouped home for conversation and compliance controls, so these don't each become a separate top-level worker option. It ships with greeting/AI-disclosure controls, a consent model, and agent-initiated hang-up, and is where further compliance controls will land. ([#19136](https://github.com/mastra-ai/mastra/pull/19136))

  **Greeting and AI disclosure**

  `configuration.greeting` controls the opening line spoken at call start. Set `allowInterruptions: false` so a legally-required AI disclosure plays through and can't be talked over (EU AI Act Art. 50), `awaitPlayout: true` to hold post-greeting work until it finishes, and `repeatEvery` to re-disclose periodically on long calls (spoken at the next turn boundary, never mid-sentence).

  ```ts
  createLiveKitWorker({
    mastra,
    agent: 'support',
    configuration: {
      greeting: {
        text: 'You are speaking with an AI assistant. This call may be recorded. How can I help?',
        allowInterruptions: false,
        awaitPlayout: true,
        repeatEvery: 3 * 60_000, // re-disclose ~every 3 minutes
      },
    },
  });
  ```

  **Per-tenant greeting**

  `greeting.text` also accepts a resolver, called once per call with the call context, so one multi-tenant agent can open differently per tenant based on the dispatch metadata:

  ```ts
  greeting: {
    text: ({ metadata }) => `Thanks for calling ${tenantName(metadata)}. You're speaking with an AI assistant.`,
    allowInterruptions: false,
  }
  ```

  **Consent**

  `configuration.consentPolicy` declares which data-use consents a call needs, as a named, extensible set (starting with `summaryStorage`) rather than one global flag. Declaring the policy enforces nothing by itself: the new `createConsentTool` captures the caller's decision at runtime — add it to your agent and it hands each decision to your own store — and your code enforces the requirement at `onCallEnd` (or before any consent-gated step).

  ```ts
  import { createConsentTool } from '@mastra/livekit';

  // in your agent's tools:
  recordConsent: createConsentTool({
    items: ['summaryStorage'],
    onGrant: async ({ item, granted, resourceId }) => {
      if (resourceId) await db.saveConsent(resourceId, item, granted);
    },
  }),
  ```

  **Agent-initiated hang-up**

  `configuration.endCall` lets the agent end the call itself. Add the new `createEndCallTool` to your agent and instruct it to say goodbye and then call the tool; the worker waits for the closing words to finish playing, holds a short audio drain (`drainMs`, default 800ms) so the tail of the goodbye isn't clipped while it's still buffered at the caller, then hangs up — running `onCallEnd` on the way out, exactly as a caller hang-up does. It works on both the agent and workflow reply paths.

  ```ts
  import { createEndCallTool } from '@mastra/livekit';

  // in your agent's tools:
  endCall: (createEndCallTool(),
    // on the worker:
    createLiveKitWorker({ mastra, agent: 'support', configuration: { endCall: {} } }));
  ```

  **Backwards compatible**

  The previous top-level `greeting` (string) and `persistGreeting` options still work as deprecated aliases for `configuration.greeting.text` and `configuration.greeting.persist`. When both are set, `configuration.greeting` wins field by field, so existing worker configs keep running unchanged.

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
