// Agent entrypoint: every turn is answered by the `callCenter` agent's own loop (model, tools,
// memory). This is the default, lowest-friction path. For the workflow-driven entrypoint, see
// voice-worker-workflow.ts. Run one worker at a time — both register as `mastra-voice`.
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
import { hasSummaryConsent, recordContact, summaryStorageRequired } from './backend';
import { mastra } from './index';
import { flushObservationalMemory } from './memory';

export default createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  // Grouped conversation & compliance config. `greeting.text` is spoken at call start. For a
  // legally-required AI disclosure, set `greeting.allowInterruptions: false` (and `awaitPlayout:
  // true`) so the caller can't talk over it — see the @mastra/livekit README. This is single-tenant,
  // so the greeting is a fixed string; `text` also accepts a resolver — `({ metadata }) => string` —
  // to open differently per tenant off the dispatch metadata when one agent serves many.
  configuration: {
    greeting: {
      text: 'Thanks for calling Meridian Trades, this is Jordan. How can I help you today?',
      // Re-disclose the AI status every ~3 minutes on long calls, spoken at the next turn boundary
      // (never mid-sentence). California SB 243 and similar rules expect periodic re-disclosure.
      repeatEvery: 3 * 60_000,
    },
    // Consent this deployment requires — a named, extensible set (add more items over time). Here we
    // require consent before storing a summary of the call (the end-of-call OM distillation).
    requireConsent: { summaryStorage: true },
    // Let the agent hang up when the call is done. It calls the `endCall` tool (see intake-tools) as
    // its last action; the worker waits for the goodbye to play out, then disconnects (running the
    // onCallEnd summary flush below). No `message` here — the agent speaks its own goodbye.
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
  // End-of-call hook: after the caller hangs up, distill the call into durable observational
  // memory ONCE, off the audio path (awaited within LiveKit's shutdown window). This is the
  // non-blocking home for OM — rather than paying for it inline on a turn. The flush passes
  // `force: true`, so even a short call below the `messageTokens` threshold is distilled here.
  //
  // Consent-aware: `configuration.requireConsent.summaryStorage` DECLARES that storing a call
  // summary needs consent; the `recordConsent` tool captures the caller's grant during the call (see
  // tools/intake-tools). When consent is required and the caller hasn't granted it, skip the summary.
  onCallEnd: async ({ memory, configuration }) => {
    if (!memory) return;
    const callerId = memory.resource ?? memory.thread;
    if (summaryStorageRequired(configuration?.requireConsent) && !hasSummaryConsent(callerId)) return;
    await flushObservationalMemory(memory);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
