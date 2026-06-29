---
'@mastra/livekit': minor
---

Brought the workflow entrypoint to feature parity with the agent entrypoint and added per-turn lifecycle hooks that work on both.

**Per-turn `onTurnComplete` hook**

`createLiveKitWorker` now fires `onTurnComplete` once per turn after the reply has finished streaming to text-to-speech — off the audio path and fire-and-forget (the worker never awaits it) — so post-turn work like memory maintenance, CRM writes, or analytics never adds to the caller's latency or delays the next turn. It receives the produced reply and the call's memory mapping, so it's the right place for a fully non-blocking `memory.updateWorkingMemory(...)`. It also fires with `result.interrupted: true` when barge-in cuts a turn short. Works on both the agent and workflow paths.

```ts
createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  onTurnComplete: async ({ result, memory }) => {
    // Runs after the caller has heard the reply — fire-and-forget, off the audio path.
    if (!memory) return;
    await crm.logContact(memory.resource, result.text);
  },
});
```

**End-of-call `onCallEnd` hook**

`createLiveKitWorker` now also fires `onCallEnd` once when the call ends (the participant disconnects / the job shuts down), via LiveKit's shutdown callback — entirely off the audio path, when latency no longer matters. Unlike `onTurnComplete`, it is _awaited_ within LiveKit's shutdown grace window, so end-of-call work finishes before the process exits. It receives the call's memory mapping and `Memory` instance — the ideal place to flush observational memory once for the whole call instead of paying for it inline per turn.

```ts
import { callCenterMemory } from './memory'; // your @mastra/memory `Memory` instance

createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  onCallEnd: async ({ memory }) => {
    // After the caller hangs up: distill the call into durable memory, off the audio path.
    if (!memory) return;
    const om = await callCenterMemory.omEngine;
    await om?.observe({ threadId: memory.thread, resourceId: memory.resource });
  },
});
```

**Workflow entrypoint parity**

The workflow path no longer silently drops options that the agent path supports:

- `toolFeedback` now fires on the workflow path too, and `onTurnComplete` carries the turn's tool calls — for any tool call the reply step surfaces to its `writer`. A new `pipeAgentReplyToWriter(agentStream, writer)` helper makes that a one-liner: it forwards the agent's text deltas _and_ its tool calls (unlike piping only `.textStream`, which silently drops tool calls) and returns the spoken text.
- The per-session request context is now forwarded into the workflow run, so steps see it.
- A new `memoryInstance` option supplies the `Memory` used to bootstrap the call thread and persist the greeting on the workflow path (where there is no agent to source it from), so the saved transcript is faithful — greeting plus every turn — just like the agent path.

```ts
import { createLiveKitWorker } from '@mastra/livekit';

createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  workflowInput: ({ messages, memory }) => ({ turn: messages, memory: memory || undefined }),
  replyStep: 'generateResponse',
  memory: ({ metadata, roomName }) => ({ thread: metadata.threadId ?? roomName, resource: metadata.resourceId ?? roomName }),
  // Bootstraps the thread + persists the greeting on the workflow path.
  memoryInstance: callCenterMemory,
  toolFeedback: ({ toolName }) => (toolName === 'checkServiceArea' ? 'Let me check your area.' : undefined),
  onTurnComplete: async ({ result, memory }) => {
    if (memory) await crm.logContact(memory.resource, result.text);
  },
});

// In the reply step — forwards text AND tool calls into the step writer:
const reply = await pipeAgentReplyToWriter(await agent.stream(messages, { memory, abortSignal }), writer);
```
