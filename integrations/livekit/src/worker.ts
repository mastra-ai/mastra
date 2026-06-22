import { defineAgent, InferenceRunner, voice } from '@livekit/agents';
import type { JobContext, JobProcess, VAD } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createMastraVoiceAgent } from './bridge';
import type { MastraStreamOptions, MastraVoiceAgent, MastraVoiceAgentMemory, VoiceToolCall } from './bridge';
import { parseSessionMetadata } from './metadata';
import type { LiveKitSessionMetadata } from './metadata';
import type { VoiceAgentTransport } from './transport';
import { inProcessTransport } from './transport-in-process';
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
  /**
   * The Mastra instance whose agents handle voice sessions. Required unless a `transport`
   * is supplied (the transport then owns how replies are generated).
   */
  mastra?: Mastra;
  /**
   * Which Mastra agent answers each session: a fixed agent key/id, or a resolver called
   * per session with the dispatch metadata. Defaults to `metadata.agentId`. Used to build
   * the default in-process transport; ignored when `transport` is set.
   */
  agent?: string | ((args: ResolveMastraAgentArgs) => string | MastraAgent | Promise<string | MastraAgent>);
  /**
   * The seam between LiveKit and Mastra. Defaults to an {@link inProcessTransport} built
   * from `mastra` + `agent`, which runs the agent in the worker process. Pass your own
   * transport (or a per-session resolver) to run the agent elsewhere — e.g. a remote
   * agent service reached over HTTP.
   */
  transport?: VoiceAgentTransport | ((args: ResolveMastraAgentArgs) => VoiceAgentTransport | Promise<VoiceAgentTransport>);
  /** Extra options merged into every in-process `agent.stream()` call. Ignored when `transport` is set. */
  streamOptions?: MastraStreamOptions;
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
  memory?:
    | false
    | ((args: ResolveMastraAgentArgs & { roomName: string }) => MastraVoiceAgentMemory | false);
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
  if (!options.mastra) {
    throw new Error(
      '@mastra/livekit: createLiveKitWorker needs `mastra` (with `agent`) to build the ' +
        'in-process transport, or an explicit `transport`.',
    );
  }
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

async function resolveTransport(
  options: CreateLiveKitWorkerOptions,
  args: ResolveMastraAgentArgs,
  requestContext: RequestContext | undefined,
): Promise<VoiceAgentTransport> {
  if (options.transport) {
    return typeof options.transport === 'function' ? options.transport(args) : options.transport;
  }
  const mastraAgent = await resolveMastraAgent(options, args);
  return inProcessTransport(mastraAgent, { requestContext, streamOptions: options.streamOptions });
}

async function resolveMemory(
  options: CreateLiveKitWorkerOptions,
  transport: VoiceAgentTransport,
  args: ResolveMastraAgentArgs,
  roomName: string,
): Promise<MastraVoiceAgentMemory | false> {
  if (options.memory === false) return false;
  if (typeof options.memory === 'function') return options.memory({ ...args, roomName });
  if (!(await transport.supportsMemory?.())) return false;
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
      const requestContext = metadata.requestContext
        ? new RequestContext<unknown>(Object.entries(metadata.requestContext))
        : undefined;
      const transport = await resolveTransport(options, args, requestContext);

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

      const memory = await resolveMemory(options, transport, args, roomName);
      if (memory) {
        try {
          await transport.ensureThread?.({ memory, roomName });
        } catch (error) {
          console.warn('@mastra/livekit: failed to create the voice call thread', error);
        }
      }

      const agent = createMastraVoiceAgent({
        transport,
        instructions: await transport.getInstructions?.({ requestContext }),
        memory,
        requestContext,
        toolFeedback: options.toolFeedback,
      });

      const session = new voice.AgentSession({
        stt: options.stt,
        tts: options.tts,
        vad,
        turnHandling: buildTurnHandling(options, turnDetection),
        ...options.sessionOptions,
      });

      await session.start({
        agent,
        room: ctx.room,
        inputOptions: options.inputOptions,
        outputOptions: options.outputOptions,
      });

      if (options.greeting) {
        session.say(options.greeting);
        if (options.persistGreeting !== false && memory) {
          try {
            await transport.persistGreeting?.({ memory, greeting: options.greeting });
          } catch (error) {
            console.warn('@mastra/livekit: failed to persist the greeting', error);
          }
        }
      }
      await options.onSessionStart?.({ session, ctx, agent, metadata });
    },
  });
}
