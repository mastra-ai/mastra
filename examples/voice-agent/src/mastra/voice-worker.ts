// Agent entrypoint: every turn is answered by the `callCenter` agent's own loop (model, tools,
// memory). This is the default, lowest-friction path. For the workflow-driven entrypoint, see
// voice-worker-workflow.ts. Run one worker at a time — both register as `mastra-voice`.
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
import { recordContact } from './backend';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  greeting: 'Thanks for calling Meridian Trades, this is Jordan. How can I help you today?',
  // Scope memory for the call: `thread` is this call, `resource` is the caller so their
  // collected details and working memory persist across calls (returning callers are
  // recognized). In production `resource` would be the verified customer (from caller ID or
  // after lookupCustomer); here it falls back to the per-call id when the caller is unknown.
  memory: ({ metadata, roomName }) => {
    const thread = metadata.threadId ?? roomName;
    return { thread, resource: metadata.resourceId ?? thread };
  },
  // Spoken filler while a tool runs, so the caller isn't left in silence. Returning nothing
  // keeps a tool silent — which is what we want for `updateWorkingMemory`: the agent is told
  // to write working memory only AFTER it has replied, so that write trails the spoken text
  // (the worker streams text to TTS as it arrives, so a trailing tool call doesn't delay what
  // the caller hears). Announcing it would just add a stray phrase after the answer.
  toolFeedback: ({ toolName }) => {
    if (toolName === 'lookupCustomer') return 'Let me pull up your account.';
    if (toolName === 'checkAvailability') return 'One moment while I check the diary.';
    if (toolName === 'bookAppointment') return 'Okay, booking that site visit for you now.';
    if (toolName === 'rescheduleAppointment') return 'Let me move that visit.';
    if (toolName === 'cancelAppointment') return 'One second while I cancel that.';
    if (toolName === 'checkServiceArea') return 'Let me check whether you are in our service area.';
    if (toolName === 'finalizeIntake') return 'Great, let me get that logged for you.';
    return undefined;
  },
  // Post-turn maintenance, fully off the audio path. `onTurnComplete` fires after the reply has
  // streamed to TTS, and the worker does NOT await it — so anything here (CRM writes, analytics,
  // a fire-and-forget `memory.updateWorkingMemory(...)`) never adds to the caller's latency or
  // delays the next turn. Here we log each turn to the contact "CRM"; the call's caller id is on
  // `memory.resource`. Errors are caught and logged by the package, so a flaky backend can't
  // break the call.
  onTurnComplete: async ({ result, memory }) => {
    if (!memory) return;
    await recordContact({
      resourceId: memory.resource ?? memory.thread,
      reply: result.text,
      tools: result.toolCalls.map(t => t.toolName),
      interrupted: result.interrupted,
    });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
