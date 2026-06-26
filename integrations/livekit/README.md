# @mastra/livekit

LiveKit voice integration for Mastra agents. LiveKit's agents framework runs the audio loop — WebRTC transport, voice activity detection, streaming speech-to-text, semantic turn detection, barge-in, and text-to-speech — and this package bridges reply generation to a Mastra agent's `stream()` call, so tools, memory, and model routing all run inside Mastra.

## Installation

```bash
npm install @mastra/livekit @livekit/agents @livekit/agents-plugin-silero @livekit/agents-plugin-livekit
```

## Usage

Create a worker entry file:

```typescript
// src/mastra/voice-worker.ts
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
```

Add a connection endpoint so frontends can join voice sessions:

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { liveKitConnectionRoute } from '@mastra/livekit';

export const mastra = new Mastra({
  server: {
    apiRoutes: [liveKitConnectionRoute({ agentName: 'mastra-voice' })],
  },
});
```

Run the worker alongside your Mastra server:

```bash
npx livekit-agents download-files
npx tsx src/mastra/voice-worker.ts dev
```

## Workflow-driven replies

Instead of an agent, you can generate each turn's reply with a Mastra **workflow**. LiveKit
owns the audio loop and calls into Mastra once per detected turn, so the workflow runs to
completion each turn — there is no suspend/resume, and no conversation state is carried between
turns (pass the transcript in via `workflowInput`).

```typescript
// src/mastra/voice-worker.ts
import { createLiveKitWorker, chatContextToMessages } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  // Map the turn into the workflow's inputData. Passing the full transcript keeps the
  // workflow stateless between turns.
  workflowInput: ({ chatCtx }) => ({ history: chatContextToMessages(chatCtx) }),
  // Only stream text from this step (optional; defaults to every step that writes text).
  replyStep: 'generateResponse',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});
```

To stream tokens (low time-to-first-token), the reply-producing step pipes its agent's text
into the step `writer`:

```typescript
const generateResponse = createStep({
  id: 'generateResponse',
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    const stream = await mastra.getAgent('voice').stream(inputData.history, { abortSignal });
    await stream.textStream.pipeTo(writer); // tokens surface as the spoken reply
    return { assistantMessage: await stream.text };
  },
});
```

A step that doesn't write to `writer` stays silent unless you pass `resultText` to derive the
reply from the final run result. For full control, pass a `generate` function — any
`VoiceReplyGenerator` that turns a turn into a text stream.

## Observability

When the Mastra instance has observability configured, the worker traces each call. It opens one `voice call` span per session, nests every turn's Mastra agent run under it, and adds a child span for each LiveKit pipeline metric — speech-to-text, text-to-speech, end-of-utterance, voice activity detection, and LLM time-to-first-token. The span closes with a per-model token, character, and audio usage roll-up. Tracing is on by default; pass `observability: false` to `createLiveKitWorker` to disable it.

## Documentation

- [Using LiveKit with Mastra](https://mastra.ai/docs/voice/livekit)
- [`@mastra/livekit` reference](https://mastra.ai/reference/voice/livekit)
- [LiveKit Agents docs](https://docs.livekit.io/agents/)
