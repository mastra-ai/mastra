// "Super Regulated Business" entrypoint: a maximally-regulated line (Northwind Financial) that turns
// on EVERY @mastra/livekit compliance control at once, to show what a fully-configured regulatory
// setup looks like. Answers each turn with the `superRegulated` agent.
//
// Run this INSTEAD of `pnpm worker` (one worker at a time — all three register as `mastra-voice`),
// then open the "Super Regulated Business" agent in Studio and start a voice call.
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
import { getConsentLedger, hasSummaryConsent, recordContact, summaryStorageRequired } from './backend';
import { mastra } from './index';
import { summarizeCall } from './memory';

export default createLiveKitWorker({
  mastra,
  agent: 'superRegulated',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  // Every compliance control the `configuration` surface offers, turned on together.
  configuration: {
    greeting: {
      // The opening AI disclosure. Spoken by the worker at call start.
      text:
        "You've reached Northwind Financial. I'm an AI virtual assistant, and this call may be recorded " +
        'for quality and compliance. I have a few quick permission questions before we begin.',
      // EU AI Act Art. 50: the caller must be told they're interacting with an AI. Make the
      // disclosure non-interruptible so it can't be talked over, and hold all post-greeting work
      // (persistence, session start) until it has fully played.
      allowInterruptions: false,
      awaitPlayout: true,
      // Persist the disclosure to the memory thread so the saved transcript proves it was given.
      persist: true,
      // California SB 243 and similar: re-disclose periodically on longer calls. 45s here so it
      // fires within a short demo call (spoken at the next turn boundary, never mid-sentence);
      // production would use minutes.
      repeatEvery: 45_000,
      repeatText: "A quick reminder: you're speaking with an AI assistant and this call is recorded.",
    },
    // Declares that storing a call summary needs consent — the one consent wired to a consequence
    // (the OM flush gate in onCallEnd below). The object form carries the audit-friendly metadata.
    // The broader consent set (callRecording, dataSharing, marketing) is captured at runtime by the
    // recordConsent tool (see tools/compliance-tools) — the named, extensible model in action.
    requireConsent: {
      summaryStorage: { required: true, purpose: 'storing a short summary of this call' },
    },
    // Agent-initiated hang-up with a GUARANTEED compliance sign-off: after the agent calls endCall
    // and its own words finish, the worker speaks this line non-interruptibly, then drops the line
    // (running onCallEnd on the way out, exactly as a caller hang-up does).
    endCall: {
      message:
        'This call has been recorded and logged for compliance. Thank you for calling Northwind Financial. Goodbye.',
      reason: 'regulated agent closed call',
    },
  },
  // Isolate this demo's memory from the Meridian demo by prefixing the caller resource, so the
  // regulated call's working memory and observational memory never mix with the trades agent's.
  memory: ({ metadata, roomName }) => {
    const thread = metadata.threadId ?? roomName;
    return { thread, resource: `regulated:${metadata.resourceId ?? thread}` };
  },
  // Spoken filler while the account lookup runs, so the caller isn't left in silence.
  toolFeedback: ({ toolName }) => {
    if (toolName === 'lookupAccountStatus') return 'Let me pull that account up for you.';
    return undefined;
  },
  // Post-turn CRM log, off the audio path and not awaited — same as the Meridian workers.
  onTurnComplete: async ({ result, memory }) => {
    if (!memory) return;
    await recordContact({
      resourceId: memory.resource ?? memory.thread,
      reply: result.text,
      tools: result.toolCalls.map(t => t.toolName),
      interrupted: result.interrupted,
    });
  },
  // End-of-call compliance close-out. Prints the full consent ledger and the gate decision so the
  // whole regulatory outcome is visible in the worker console, then runs the consent-gated call
  // summary: one `summarizeThread()` pass into the business's own records, ONLY if summary-storage
  // consent was granted (the correct compliance behavior — no consent, no stored summary).
  onCallEnd: async ({ memory, configuration }) => {
    if (!memory) return;
    const callerId = memory.resource ?? memory.thread;
    const consents = getConsentLedger(callerId);
    const gated = summaryStorageRequired(configuration?.requireConsent) && !hasSummaryConsent(callerId);
    console.info('[regulated] call ended — compliance summary', {
      callerId,
      consents,
      callSummary: gated ? 'SKIPPED (no summaryStorage consent)' : 'RUNNING (summarizing call)',
    });
    if (gated) return;
    await summarizeCall(memory);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
