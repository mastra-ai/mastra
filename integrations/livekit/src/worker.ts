import { defineAgent, InferenceRunner, voice } from '@livekit/agents';
import type { JobContext, JobProcess, VAD } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createMastraVoiceAgent } from './bridge';
import type { MastraVoiceAgent, MastraVoiceAgentMemory, VoiceToolCall } from './bridge';
import { parseSessionMetadata } from './metadata';
import type { LiveKitSessionMetadata } from './metadata';
import { startVoiceCallObservability } from './observability';
import { ensureVoiceCallThread, persistSpokenGreeting } from './voice-thread';
import { isEouMethodRequested, queueWorkerSetup, requestEouMethod } from './worker-setup';

const EOU_METHODS = {
  english: 'lk_end_of_utterance_en',
  multilingual: 'lk_end_of_utterance_multilingual',
} as const;

interface WorkerUserData {
  vad?: VAD;
  [key: string]: unknown;
}

type TurnDetectionSetting = Exclude<voice.AgentSessionOptions['turnDetection'], undefined>;

export interface ResolveMastraAgentArgs {
  metadata: LiveKitSessionMetadata;
  ctx: JobContext;
}

export interface SessionStartArgs {
  session: voice.AgentSession;
  ctx: JobContext;
  agent: MastraVoiceAgent;
  metadata: LiveKitSessionMetadata;
}

export interface CreateLiveKitWorkerOptions {
  /** The Mastra instance whose agents handle voice sessions. */
  mastra: Mastra;
  /**
   * Which Mastra agent answers each session: a fixed agent key/id, or a resolver called
   * per session with the dispatch metadata. Defaults to `metadata.agentId`.
   */
  agent?: string | ((args: ResolveMastraAgentArgs) => string | MastraAgent | Promise<string | MastraAgent>);
  /** Speech-to-text: a LiveKit plugin instance or an inference model string like 'deepgram/nova-3'. */
  stt?: voice.AgentSessionOptions['stt'];
  /** Text-to-speech: a LiveKit plugin instance or an inference model string like 'cartesia/sonic-3'. */
  tts?: voice.AgentSessionOptions['tts'];
  /**
   * Voice activity detection. `'silero'` (default) loads the Silero VAD from
   * `@livekit/agents-plugin-silero`; pass an instance to bring your own, or `false` to disable.
   */
  vad?: VAD | 'silero' | false;
  /**
   * End-of-turn detection. `'multilingual'` or `'english'` load LiveKit's semantic turn
   * detector model from `@livekit/agents-plugin-livekit`; other values are passed through
   * (e.g. `'vad'`, `'stt'`, `'manual'`).
   */
  turnDetection?: 'multilingual' | 'english' | TurnDetectionSetting;
  /** Turn handling tuning (endpointing delays, interruption sensitivity, preemptive generation). */
  turnHandling?: voice.AgentSessionOptions['turnHandling'];
  /** Extra `AgentSession` options merged over what this helper builds. */
  sessionOptions?: Partial<voice.AgentSessionOptions>;
  /**
   * Memory mapping. Defaults to `{ thread: metadata.threadId ?? room name, resource:
   * metadata.resourceId ?? thread }` when the resolved agent has memory configured.
   * Pass `false` to disable, or a function to customize.
   */
  memory?: false | ((args: ResolveMastraAgentArgs & { roomName: string }) => MastraVoiceAgentMemory | false);
  /** Spoken while a Mastra tool call runs. See {@link MastraVoiceAgentOptions.toolFeedback}. */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /** Static greeting spoken when the session starts. */
  greeting?: string;
  /**
   * Save the spoken greeting to the memory thread as an assistant message, so the saved
   * thread is a faithful call transcript. Defaults to `true`; only applies when a
   * greeting is set and memory is enabled.
   */
  persistGreeting?: boolean;
  /**
   * Voice-pipeline observability. When the Mastra instance has observability configured, each
   * session opens a `voice call` trace: LiveKit's STT, TTS, end-of-utterance, VAD, and LLM
   * latency metrics become child spans, and every turn's Mastra agent run nests under the call,
   * which closes with a token/audio usage roll-up. Defaults to `true`; pass `false` to disable.
   */
  observability?: boolean;
  inputOptions?: Parameters<voice.AgentSession['start']>[0]['inputOptions'];
  outputOptions?: Parameters<voice.AgentSession['start']>[0]['outputOptions'];
  /** Called after the session starts — attach event listeners, trigger replies, etc. */
  onSessionStart?: (args: SessionStartArgs) => void | Promise<void>;
}

async function loadSileroVad(): Promise<VAD> {
  let silero;
  try {
    silero = await import('@livekit/agents-plugin-silero');
  } catch (error) {
    throw new Error(
      "@mastra/livekit: voice activity detection requires '@livekit/agents-plugin-silero'. " +
        'Install it, pass your own `vad` instance, or set `vad: false`.',
      { cause: error },
    );
  }
  return silero.VAD.load();
}

async function loadTurnDetector(kind: 'multilingual' | 'english'): Promise<TurnDetectionSetting> {
  let plugin;
  try {
    plugin = await import('@livekit/agents-plugin-livekit');
  } catch (error) {
    throw new Error(
      `@mastra/livekit: turnDetection '${kind}' requires '@livekit/agents-plugin-livekit'. ` +
        "Install it or use a built-in mode like 'vad' or 'stt'.",
      { cause: error },
    );
  }
  return kind === 'english'
    ? (new plugin.turnDetector.EnglishModel() as TurnDetectionSetting)
    : (new plugin.turnDetector.MultilingualModel() as TurnDetectionSetting);
}

async function resolveMastraAgent(
  options: CreateLiveKitWorkerOptions,
  args: ResolveMastraAgentArgs,
): Promise<MastraAgent> {
  let ref: string | MastraAgent | undefined =
    typeof options.agent === 'function' ? await options.agent(args) : options.agent;
  ref ??= args.metadata.agentId;
  if (!ref) {
    throw new Error(
      '@mastra/livekit: no Mastra agent specified. Set `agent` on createLiveKitWorker or pass ' +
        '`agentId` in the dispatch metadata (e.g. via liveKitConnectionRoute).',
    );
  }
  if (typeof ref !== 'string') return ref;
  try {
    return options.mastra.getAgentById(ref);
  } catch {
    return options.mastra.getAgent(ref);
  }
}

function resolveMemory(
  options: CreateLiveKitWorkerOptions,
  mastraAgent: MastraAgent,
  args: ResolveMastraAgentArgs,
  roomName: string,
): MastraVoiceAgentMemory | false {
  if (options.memory === false) return false;
  if (typeof options.memory === 'function') return options.memory({ ...args, roomName });
  if (!mastraAgent.hasOwnMemory()) return false;
  const thread = args.metadata.threadId ?? roomName;
  return { thread, resource: args.metadata.resourceId ?? thread };
}

export function buildTurnHandling(
  options: Pick<CreateLiveKitWorkerOptions, 'turnHandling'>,
  turnDetection: TurnDetectionSetting | undefined,
): voice.AgentSessionOptions['turnHandling'] {
  return {
    ...(turnDetection ? { turnDetection } : {}),
    // Preemptive generation re-runs the Mastra agent on interim transcripts (up to 3
    // times per turn), and every run persists the user message to the memory thread —
    // duplicating and even saving partial transcripts. Off by default; opt back in via
    // `turnHandling.preemptiveGeneration` if the latency win matters more than exact
    // thread history.
    preemptiveGeneration: { enabled: false },
    ...options.turnHandling,
  };
}

async function resolveInstructions(
  mastraAgent: MastraAgent,
  requestContext: RequestContext | undefined,
): Promise<string | undefined> {
  try {
    const instructions = await mastraAgent.getInstructions({ requestContext });
    return typeof instructions === 'string' ? instructions : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds a LiveKit agent worker definition that answers voice sessions with Mastra agents.
 *
 * Use as the default export of your worker entry file, then run it with the LiveKit
 * agents CLI:
 *
 * ```ts
 * // src/mastra/voice-worker.ts
 * import { fileURLToPath } from 'node:url';
 * import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
 * import { mastra } from './index';
 *
 * export default createLiveKitWorker({
 *   mastra,
 *   stt: 'deepgram/nova-3',
 *   tts: 'cartesia/sonic-3',
 *   turnDetection: 'multilingual',
 * });
 *
 * if (process.argv[1] === fileURLToPath(import.meta.url)) {
 *   runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
 * }
 * ```
 */
export function createLiveKitWorker(options: CreateLiveKitWorkerOptions) {
  const wantsSileroVad = options.vad === undefined || options.vad === 'silero';

  // The turn detector's inference runners register at plugin-import time, and the agent
  // server only spawns its inference process for runners registered before it starts —
  // so begin the import now (worker definition happens at module scope, before
  // runLiveKitWorker boots the server, which awaits this).
  if (options.turnDetection === 'multilingual' || options.turnDetection === 'english') {
    requestEouMethod(EOU_METHODS[options.turnDetection]);
    queueWorkerSetup(
      import('@livekit/agents-plugin-livekit')
        .then(() => {
          // The plugin registers both language runners; keep only the requested ones so
          // the inference process doesn't initialize (and require model files for) both.
          for (const method of Object.values(EOU_METHODS)) {
            if (!isEouMethodRequested(method)) {
              delete InferenceRunner.registeredRunners[method];
            }
          }
        })
        .catch(() => {
          // Surfaced with install guidance when the session actually needs it.
        }),
    );
  }

  return defineAgent<WorkerUserData>({
    prewarm: async (proc: JobProcess<WorkerUserData>) => {
      if (wantsSileroVad) {
        proc.userData.vad = await loadSileroVad();
      }
    },
    entry: async (ctx: JobContext<WorkerUserData>) => {
      const metadata = parseSessionMetadata(ctx.job.metadata);
      const args: ResolveMastraAgentArgs = { metadata, ctx };
      const mastraAgent = await resolveMastraAgent(options, args);
      const requestContext = metadata.requestContext
        ? new RequestContext<unknown>(Object.entries(metadata.requestContext))
        : undefined;

      await ctx.connect();
      const roomName = ctx.room.name ?? 'mastra-voice';

      let vad: VAD | undefined;
      if (options.vad && options.vad !== 'silero') {
        vad = options.vad;
      } else if (wantsSileroVad) {
        vad = ctx.proc.userData.vad ?? (await loadSileroVad());
      }

      let turnDetection: TurnDetectionSetting | undefined;
      if (options.turnDetection === 'multilingual' || options.turnDetection === 'english') {
        turnDetection = await loadTurnDetector(options.turnDetection);
      } else {
        turnDetection = options.turnDetection;
      }

      const memory = resolveMemory(options, mastraAgent, args, roomName);
      const memoryInstance = memory ? await mastraAgent.getMemory({ requestContext }) : null;
      if (memory && memoryInstance) {
        try {
          await ensureVoiceCallThread({
            memory: memoryInstance,
            threadId: memory.thread,
            resourceId: memory.resource ?? memory.thread,
            roomName,
          });
        } catch (error) {
          console.warn('@mastra/livekit: failed to create the voice call thread', error);
        }
      }

      // One `voice call` trace per session: per-turn agent runs nest under it (via
      // tracingContext below) and LiveKit's pipeline metrics attach as child spans. No-ops
      // when the Mastra instance has no observability configured.
      const voiceObs =
        options.observability === false
          ? undefined
          : startVoiceCallObservability({
              mastra: options.mastra,
              agentId: mastraAgent.id ?? mastraAgent.name,
              roomName,
              metadata,
              requestContext,
            });
      // Close the call span when the job ends, however it ends (registered up front so a
      // failed start still finalizes); finalize() is idempotent.
      if (voiceObs) {
        ctx.addShutdownCallback(async () => {
          voiceObs.finalize();
        });
      }

      const agent = createMastraVoiceAgent({
        agent: mastraAgent,
        instructions: await resolveInstructions(mastraAgent, requestContext),
        memory,
        requestContext,
        toolFeedback: options.toolFeedback,
        streamOptions: voiceObs ? { tracingContext: voiceObs.tracingContext } : undefined,
      });

      const session = new voice.AgentSession({
        stt: options.stt,
        tts: options.tts,
        vad,
        turnHandling: buildTurnHandling(options, turnDetection),
        ...options.sessionOptions,
      });

      // Subscribe before start so the first turn's metrics are captured.
      voiceObs?.attach(session);

      try {
        await session.start({
          agent,
          room: ctx.room,
          inputOptions: options.inputOptions,
          outputOptions: options.outputOptions,
        });

        if (options.greeting) {
          session.say(options.greeting);
          if (options.persistGreeting !== false && memory && memoryInstance) {
            try {
              await persistSpokenGreeting({
                memory: memoryInstance,
                threadId: memory.thread,
                resourceId: memory.resource ?? memory.thread,
                greeting: options.greeting,
              });
            } catch (error) {
              console.warn('@mastra/livekit: failed to persist the greeting', error);
            }
          }
        }
        await options.onSessionStart?.({ session, ctx, agent, metadata });
      } catch (error) {
        voiceObs?.finalize({ error });
        throw error;
      }
    },
  });
}
