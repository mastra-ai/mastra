---
'@mastra/livekit': minor
---

Added two lifecycle hooks to voice workers, and brought the workflow path up to the same feature set as the agent path.

**Run work after each turn with `onTurnComplete`**

`createLiveKitWorker` now calls `onTurnComplete` once per turn, right after the reply finishes playing to the caller. It runs in the background — the worker never waits for it — so you can save memory, update your CRM, or record analytics without adding any delay for the caller or the next reply. The hook receives the reply that was spoken and the call's memory mapping, so it's the place to update working memory without blocking. It also runs with `result.interrupted: true` when the caller talks over the agent. Works whether you drive replies with an agent or a workflow.

```ts
createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  onTurnComplete: async ({ result, memory }) => {
    // Runs after the caller has heard the reply, in the background.
    if (!memory) return;
    await crm.logContact(memory.resource, result.text);
  },
});
```

**Run work when the call ends with `onCallEnd`**

`createLiveKitWorker` now also calls `onCallEnd` once when the call ends (the caller hangs up or the job shuts down). Unlike `onTurnComplete`, the worker waits for it to finish before the process exits — so it's the place for end-of-call work like summarizing the whole conversation into long-term memory once, instead of paying that cost on every turn. The hook receives the call's memory mapping and its `Memory` instance.

```ts
import { callCenterMemory } from './memory'; // your @mastra/memory Memory instance

createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  onCallEnd: async ({ memory }) => {
    // After the caller hangs up: save a lasting summary of the call.
    if (!memory) return;
    const om = await callCenterMemory.omEngine;
    await om?.observe({ threadId: memory.thread, resourceId: memory.resource });
  },
});
```

**Workflow replies now support the same options as agent replies**

Driving replies with a workflow no longer drops options the agent path already supported:

- `toolFeedback` now runs on the workflow path, and `onTurnComplete` includes the turn's tool calls. A new `pipeAgentReplyToWriter(agentStream, writer)` helper makes this a one-liner: it streams the agent's words to the caller *and* forwards its tool calls, then returns the spoken text. Streaming only the agent's text would drop the tool calls.
- The per-call request context now reaches workflow steps.
- A new `memoryInstance` option gives the workflow path a `Memory` instance to open the call's thread and save the greeting, so the saved conversation is complete — greeting included — just like the agent path.

```ts
import { createLiveKitWorker } from '@mastra/livekit';

createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  workflowInput: ({ messages, memory }) => ({ turn: messages, memory: memory || undefined }),
  replyStep: 'generateResponse',
  memory: ({ metadata, roomName }) => ({ thread: metadata.threadId ?? roomName, resource: metadata.resourceId ?? roomName }),
  // Opens the thread and saves the greeting on the workflow path.
  memoryInstance: callCenterMemory,
  toolFeedback: ({ toolName }) => (toolName === 'checkServiceArea' ? 'Let me check your area.' : undefined),
  onTurnComplete: async ({ result, memory }) => {
    if (memory) await crm.logContact(memory.resource, result.text);
  },
});

// In the reply step — streams the agent's words and forwards its tool calls:
const reply = await pipeAgentReplyToWriter(await agent.stream(messages, { memory, abortSignal }), writer);
```
