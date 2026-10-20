// Plugin entrypoint: YOU own the LiveKit session, Mastra is just the LLM slot. Unlike the other
// workers (which hand the session to `createLiveKitWorker`), this file builds the
// `voice.AgentSession` directly — every LiveKit lifecycle hook, node override, and session option
// is yours — and drops `MastraLLM` from `@mastra/livekit/plugin` into the `llm` slot, pointed at
// the example's Mastra server over HTTP. The worker process needs no Mastra app, database, or
// model-provider keys: the agent loop (tools, memory, observability) runs on the server.
//
// Start the server first (`pnpm dev`), then run this INSTEAD of `pnpm worker` (one worker at a
// time — all entrypoints use LIVEKIT_AGENT_NAME, defaulting to `mastra-voice`).
import { fileURLToPath } from 'node:url';
import { defineAgent, voice } from '@livekit/agents';
import type { VAD } from '@livekit/agents';
import * as livekitPlugin from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { MastraClient } from '@mastra/client-js';
import { parseSessionMetadata } from '@mastra/livekit';
import { createLiveKitTranscriptPersistence, MastraLLM } from '@mastra/livekit/plugin';
import { DEFAULT_END_CALL_TOOL, runEndCall, runLiveKitWorker, speakGreeting } from '@mastra/livekit/worker';
import { liveKitAgentName } from './livekit';

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
    const metadata = parseSessionMetadata(ctx.job.metadata, { validate: true });
    await ctx.connect();
    const roomName = ctx.room.name ?? 'mastra-voice';

    // Scope memory for the call from the dispatch metadata (the JSON `liveKitConnectionRoute`
    // sends): `thread` is this call, `resource` is the caller — same mapping as the other workers,
    // resolved by this worker because in plugin mode the customer owns per-call identity.
    // DEMO ONLY: these ids come from the connection request body, i.e. they are caller-controlled —
    // a caller who picks another `resourceId` reads that caller's memory. In production, derive
    // `resource` from an authenticated user identity (caller ID alone is not authentication) and
    // mint `thread` server-side; never trust client-supplied memory scope.
    const thread = metadata.threadId ?? roomName;
    const resource = metadata.resourceId ?? thread;

    // Agent-initiated hang-up, rebuilt customer-side in a few lines: the server-side agent calls
    // its `endCall` tool (see tools/intake-tools.ts), `onToolCall` sees the tool-call chunk
    // mid-stream, and `runEndCall` waits for the goodbye to finish playing, then disconnects.
    // Assigned below, before any turn can fire the hook.
    let session: voice.AgentSession;
    let ending = false;

    const persistence = await createLiveKitTranscriptPersistence({
      remote: {
        client: new MastraClient({
          baseUrl: MASTRA_URL,
          headers: process.env.MASTRA_API_TOKEN
            ? { Authorization: `Bearer ${process.env.MASTRA_API_TOKEN}` }
            : undefined,
        }),
        agentId: 'callCenter',
      },
      sessionId: ctx.job.id,
      memory: { thread, resource },
      requestContext: metadata.requestContext,
      onBarrier: durationMs => console.info('[plugin] transcript wait', { durationMs }),
      onError: event => console.warn('[plugin] transcript persistence error', event),
    });
    const llm = new MastraLLM({
      transcriptPersistence: persistence,
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
      ...metadata.sessionConfig?.options,
      vad: ctx.proc.userData.vad ?? (await silero.VAD.load()),
      turnHandling: {
        ...metadata.sessionConfig?.options.turnHandling,
        turnDetection: new livekitPlugin.turnDetector.MultilingualModel(),
        // Keep speculation off for this demo's business tools. Managed persistence filters
        // discarded speech, but cannot undo a tool's side effects.
        preemptiveGeneration: { enabled: false },
      },
    });

    persistence.attach(session);
    ctx.addShutdownCallback(async () => {
      const status = await persistence.close();
      console.info('[plugin] transcript closed', { thread, ...status });
      if (status.pending || status.failed) console.warn('[plugin] transcript is incomplete', status);
    });

    try {
      await session.start({
        // These instructions never reach the Mastra agent; edit its server-side instructions.
        agent: new voice.Agent({ instructions: 'Replies are generated by a remote Mastra agent.' }),
        room: ctx.room,
      });
      // LiveKit commits this greeting; the binding saves it through the server's Memory API.
      await speakGreeting(session, {
        text: 'Thanks for calling Meridian Trades, this is Jordan. How can I help you today?',
      });
    } catch (error) {
      await persistence.close();
      throw error;
    }
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: liveKitAgentName });
}
