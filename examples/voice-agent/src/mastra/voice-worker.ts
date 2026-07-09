// Agent entrypoint: every turn is answered by the `callCenter` agent's own loop (model, tools,
// memory). This is the default, lowest-friction path. For the workflow-driven entrypoint, see
// voice-worker-workflow.ts. Run one worker at a time — both register as `mastra-voice`.
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
import { recordContact } from './backend';
import { mastra } from './index';
import { summarizeCall } from './memory';

export default createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  // Grouped conversation config. This default worker is deliberately PERMISSIVE — no consent
  // gating, no periodic re-disclosure — so the demo flows friction-free; every compliance
  // safeguard (`consentPolicy`, `greeting.repeatEvery`, `allowInterruptions: false`, consent
  // sweep) lives in voice-worker-regulated.ts, which exists to demonstrate them all at once.
  // `greeting.text` is spoken at call start; it also accepts a resolver — `({ metadata }) =>
  // string` — to open differently per tenant off the dispatch metadata when one agent serves many.
  configuration: {
    greeting: {
      text: 'Thanks for calling Meridian Trades, this is Jordan. How can I help you today?',
    },
    // Let the agent hang up when the call is done. It calls the `endCall` tool (see intake-tools) as
    // its last action; the worker waits for the goodbye to play out, then disconnects (running the
    // onCallEnd summary below). No `message` here — the agent speaks its own goodbye.
    endCall: {},
  },
  // Scope memory for the call: `thread` is this call, `resource` is the caller so their
  // collected details and working memory persist across calls (returning callers are
  // recognized). In production `resource` would be the verified customer (from caller ID or
  // after lookupCustomer); here it falls back to the per-call id when the caller is unknown.
  memory: ({ metadata, roomName }) => {
    const thread = metadata.threadId ?? roomName;
    return { thread, resource: metadata.resourceId ?? thread };
  },
  // Spoken filler while a tool runs, so the caller isn't left in silence. Returning nothing
  // keeps a tool silent. (Working memory no longer surfaces here at all: with
  // `manageWorkingMemory` in ../memory.ts the agent has no in-loop memory tool — the Observer
  // writes it off the audio path.)
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
  // End-of-call hook: after the caller hangs up, summarize the call ONCE into the business's own
  // records — off the audio path, awaited within LiveKit's shutdown window so it finishes before
  // the worker process exits. `summarizeCall` (memory.ts) runs `memory.summarizeThread()`: a
  // standalone one-shot summarization + structured extraction over the whole call, deliberately
  // outside observational memory's lifecycle (OM keeps doing cross-call facts on its own cadence).
  // Permissive default: the summary ALWAYS runs. For the consent-gated version (no consent → no
  // stored summary), see voice-worker-regulated.ts.
  onCallEnd: async ({ memory }) => {
    if (!memory) return;
    await summarizeCall(memory);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
