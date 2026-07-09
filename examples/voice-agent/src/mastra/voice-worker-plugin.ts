// Plugin entrypoint: YOU own the LiveKit session, Mastra is just the LLM slot. Unlike the other
// workers (which hand the session to `createLiveKitWorker`), this file builds the
// `voice.AgentSession` directly — every LiveKit lifecycle hook, node override, and session option
// is yours — and drops `MastraLLM` from `@mastra/livekit/plugin` into the `llm` slot, pointed at
// the example's Mastra server over HTTP. The worker process needs no Mastra app, database, or
// model-provider keys: the agent loop (tools, memory, observability) runs on the server.
//
// Start the server first (`pnpm dev`), then run this INSTEAD of `pnpm worker` (one worker at a
// time — all entrypoints register as `mastra-voice`).
import { fileURLToPath } from 'node:url';
import { defineAgent, voice } from '@livekit/agents';
import type { VAD } from '@livekit/agents';
import * as livekitPlugin from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { MastraLLM } from '@mastra/livekit/plugin';
import { DEFAULT_END_CALL_TOOL, runEndCall, runLiveKitWorker, speakGreeting } from '@mastra/livekit/worker';

// The example's Mastra server (`pnpm dev`). In production this is wherever the app is deployed —
// the whole point of the plugin is that the worker reaches it over HTTP.
const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111';

interface PluginWorkerUserData {
  vad?: VAD;
  [key: string]: unknown;
}

export default defineAgent<PluginWorkerUserData>({
  prewarm: async proc => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async ctx => {
    await ctx.connect();
    const roomName = ctx.room.name ?? 'mastra-voice';

    // Scope memory for the call from the dispatch metadata (the JSON `liveKitConnectionRoute`
    // sends): `thread` is this call, `resource` is the caller — same mapping as the other workers,
    // resolved by this worker because in plugin mode the customer owns per-call identity.
    let metadata: { threadId?: string; resourceId?: string; requestContext?: Record<string, unknown> } = {};
    try {
      metadata = JSON.parse(ctx.job.metadata || '{}');
    } catch {
      // Dispatch metadata is caller-controlled and may not be JSON; fall back to the room name.
    }
    // DEMO ONLY: these ids come from the connection request body, i.e. they are caller-controlled —
    // a caller who picks another `resourceId` reads that caller's memory. In production, derive
    // `resource` from a VERIFIED identity (the SIP caller number, your authenticated user id) and
    // mint `thread` server-side; never trust client-supplied memory scope.
    const thread = metadata.threadId ?? roomName;
    const resource = metadata.resourceId ?? thread;

    // Agent-initiated hang-up, rebuilt customer-side in a few lines: the server-side agent calls
    // its `endCall` tool (see tools/intake-tools.ts), `onToolCall` sees the tool-call chunk
    // mid-stream, and `runEndCall` waits for the goodbye to finish playing, then disconnects.
    // Assigned below, before any turn can fire the hook.
    let session: voice.AgentSession;
    let ending = false;

    const llm = new MastraLLM({
      remote: { baseUrl: MASTRA_URL, agentId: 'callCenter' },
      memory: { thread, resource },
      requestContext: metadata.requestContext,
      // Spoken filler while a server-side tool runs — same fillers as the wrapper workers.
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
      onToolCall: ({ toolName }) => {
        if (toolName !== DEFAULT_END_CALL_TOOL || ending) return;
        ending = true;
        void runEndCall(session, ctx, {}, console);
      },
      // Post-turn hook, off the audio path — the reply text, tool calls, token usage, and whether
      // barge-in cut the turn short. The place for CRM writes / analytics without a Mastra app.
      onTurnComplete: ({ result }) => {
        console.info('[plugin] turn complete', {
          reply: result.text,
          tools: result.toolCalls.map(t => t.toolName),
          interrupted: result.interrupted,
          usage: result.usage,
        });
      },
    });

    session = new voice.AgentSession({
      llm,
      stt: 'deepgram/nova-3',
      tts: 'cartesia/sonic-3',
      vad: ctx.proc.userData.vad ?? (await silero.VAD.load()),
      turnHandling: {
        turnDetection: new livekitPlugin.turnDetector.MultilingualModel(),
        // Keep preemptive generation OFF when `memory` is set: a speculative turn that completes
        // before LiveKit discards it would persist garbage to the thread.
        preemptiveGeneration: { enabled: false },
      },
    });

    await session.start({
      // These instructions are LiveKit-side only and never reach the Mastra agent — the server-side
      // agent's own instructions are authoritative. Put prompt changes there, not here.
      agent: new voice.Agent({ instructions: 'Replies are generated by a remote Mastra agent.' }),
      room: ctx.room,
    });

    // Customer-owned greeting via the promoted helper (or plain `session.say(...)`). Note: unlike
    // the wrapper, nothing persists the greeting to the Mastra thread — the worker has no Mastra
    // app. It still lands in LiveKit's chat context, so per-turn message extraction is unaffected.
    await speakGreeting(session, {
      text: 'Thanks for calling Meridian Trades, this is Jordan. How can I help you today?',
    });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
