import { defineAgent, InferenceRunner, voice } from '@livekit/agents';
import type { JobContext, JobProcess, VAD } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import type { Workflow } from '@mastra/core/workflows';
import { createMastraVoiceAgent } from './bridge';
import type {
  MastraVoiceAgent,
  MastraVoiceAgentMemory,
  VoiceReplyGenerator,
  VoiceToolCall,
  VoiceTurnCompleteHook,
  VoiceTurnContext,
} from './bridge';
import { parseSessionMetadata } from './metadata';
import type { LiveKitSessionMetadata } from './metadata';
import { startVoiceCallObservability } from './observability';
import { ensureVoiceCallThread, persistSpokenGreeting } from './voice-thread';
import { isEouMethodRequested, queueWorkerSetup, requestEouMethod } from './worker-setup';
import { createWorkflowReplyGenerator } from './workflow-generator';

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

/** Context handed to {@link CreateLiveKitWorkerOptions.onCallEnd} when the call ends. */
export interface VoiceCallEndArgs {
  /** Resolved memory mapping for the call (thread/resource), or `false` if memory was disabled. */
  memory: MastraVoiceAgentMemory | false;
  /**
   * The `Memory` instance backing the call, or `null`. On the agent path it's the agent's
   * (storage-equipped) memory; on the workflow/custom path it's the resolved `memoryInstance`. Use
   * it for end-of-call maintenance — e.g. flush observational memory off the audio path.
   */
  memoryInstance: MastraMemory | null;
  /** Dispatch metadata for the call. */
  metadata: LiveKitSessionMetadata;
  /** Request context for the call, if any. */
  requestContext?: RequestContext;
  /** The LiveKit room name. */
  roomName: string;
  /** The LiveKit job context, for advanced teardown needs. */
  ctx: JobContext;
}

/**
 * Fired once when the call ends. Runs off the audio path inside LiveKit's shutdown grace window,
 * and — unlike the per-turn {@link MastraVoiceAgentOptions.onTurnComplete} — it is AWAITED, so the
 * work completes before the worker process exits. A thrown error is logged, not propagated.
 */
export type VoiceCallEndHook = (args: VoiceCallEndArgs) => void | Promise<void>;

export interface CreateLiveKitWorkerOptions {
  /** The Mastra instance whose agents handle voice sessions. */
  mastra: Mastra;
  /**
   * Which Mastra agent answers each session: a fixed agent key/id, or a resolver called
   * per session with the dispatch metadata. Defaults to `metadata.agentId`.
   */
  agent?: string | ((args: ResolveMastraAgentArgs) => string | MastraAgent | Promise<string | MastraAgent>);
  /**
   * Generate each turn's reply with a Mastra workflow instead of an agent: a `Workflow`
   * instance, a fixed workflow key/id, or a resolver that returns a workflow id per session.
   * The workflow runs once to completion per turn (LiveKit owns the turn boundary, so there is
   * no suspend/resume). Mutually exclusive with `agent`; requires
   * {@link CreateLiveKitWorkerOptions.workflowInput}.
   */
  workflow?: string | Workflow | ((args: ResolveMastraAgentArgs) => string | Promise<string>);
  /**
   * Maps a turn into the workflow's `inputData`. Required when `workflow` is set. A stateless
   * mapping that passes the full transcript each turn avoids carrying conversation state in the
   * workflow, e.g. `({ chatCtx }) => ({ history: chatContextToMessages(chatCtx) })`.
   */
  workflowInput?: (args: VoiceTurnContext & { metadata: LiveKitSessionMetadata }) => unknown | Promise<unknown>;
  /** Only stream text from this workflow step id. Defaults to every step that writes to its `writer`. */
  replyStep?: string;
  /** Fallback when the workflow streams no text via `writer`: derive the spoken reply from the final result. */
  resultText?: (result: unknown) => string | undefined | void;
  /** Lowest-level escape hatch: supply any reply generator directly (a custom workflow, remote bridge, …). */
  generate?: VoiceReplyGenerator;
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
  /**
   * The `Memory` instance used to bootstrap the call thread and persist the greeting on the
   * workflow / custom-generator path, where there is no agent to source it from. Ignored on the
   * agent path (the resolved agent's own memory is used). Pass the same `Memory` your workflow
   * steps read and write through, so the saved thread is one faithful transcript (the up-front
   * thread + the persisted greeting + every turn the steps write). If the `Memory` has no
   * `storage` of its own, this worker's Mastra storage is injected into it (same as
   * `agent.getMemory()` does), so a `Memory` that relies on the Mastra instance for storage works.
   */
  memoryInstance?:
    | MastraMemory
    | ((args: ResolveMastraAgentArgs) => MastraMemory | undefined | Promise<MastraMemory | undefined>);
  /**
   * Spoken while a Mastra tool call runs. Works on both the agent and workflow paths; on the
   * workflow path it fires only for tool calls the reply step surfaces to its `writer` (use
   * `pipeAgentReplyToWriter`). See {@link MastraVoiceAgentOptions.toolFeedback}.
   */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /**
   * Fired once per turn after the reply has streamed to text-to-speech, off the audio path and
   * fire-and-forget. Works on both the agent and workflow paths. Use it to fully background
   * post-turn memory maintenance — e.g. a non-blocking `memory.updateWorkingMemory(...)` — so it
   * never adds to the caller's latency. See {@link MastraVoiceAgentOptions.onTurnComplete}.
   */
  onTurnComplete?: VoiceTurnCompleteHook;
  /**
   * Fired once when the call ends (participant disconnects / job shuts down), via LiveKit's
   * shutdown callback — entirely off the audio path, when latency no longer matters. Unlike
   * `onTurnComplete`, it is AWAITED within LiveKit's shutdown grace window, so end-of-call work
   * completes before the process exits. The ideal place to flush observational memory once for the
   * whole call (instead of paying for it inline per turn). Keep it to a few seconds so it fits the
   * grace window; a thrown error is logged, not propagated. See {@link VoiceCallEndArgs}.
   */
  onCallEnd?: VoiceCallEndHook;
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

// Returns the workflow boxed in an object: `Workflow` is thenable (it has a `.then()` builder
// method), so a bare `Promise<Workflow>` return — or awaiting a `Workflow`-typed value — trips
// TS's thenable checks and, at runtime, `await workflow` would call the builder's `.then`.
async function resolveWorkflow(
  options: CreateLiveKitWorkerOptions,
  args: ResolveMastraAgentArgs,
): Promise<{ workflow: Workflow }> {
  const resolver = options.workflow;
  // The function form resolves to an id string (safe to await); a Workflow instance is only
  // accepted as a direct value, never awaited.
  const ref: string | Workflow = typeof resolver === 'function' ? await resolver(args) : (resolver ?? '');
  if (!ref) {
    throw new Error('@mastra/livekit: no workflow specified. Set `workflow` on createLiveKitWorker.');
  }
  if (typeof ref !== 'string') return { workflow: ref };
  // getWorkflowById matches by workflow id and falls back to the registration key.
  return { workflow: options.mastra.getWorkflowById(ref as never) as Workflow };
}

function resolveMemory(
  options: CreateLiveKitWorkerOptions,
  mastraAgent: MastraAgent | undefined,
  args: ResolveMastraAgentArgs,
  roomName: string,
): MastraVoiceAgentMemory | false {
  if (options.memory === false) return false;
  if (typeof options.memory === 'function') return options.memory({ ...args, roomName });
  // With an agent, default to memory only when the agent has its own. With a workflow (no
  // agent), default the thread/resource mapping so the workflow input can use it.
  if (mastraAgent && !mastraAgent.hasOwnMemory()) return false;
  const thread = args.metadata.threadId ?? roomName;
  return { thread, resource: args.metadata.resourceId ?? thread };
}

// The Memory instance backing thread bootstrap + greeting persistence. With an agent it comes
// from the agent; on the workflow/custom-generator path there is no agent, so it comes from the
// `memoryInstance` option (instance or resolver). Returns null when unavailable — bootstrap and
// greeting persistence are then skipped and the generator owns persistence.
export async function resolveMemoryInstance(
  options: Pick<CreateLiveKitWorkerOptions, 'memoryInstance' | 'mastra'>,
  mastraAgent: MastraAgent | undefined,
  args: ResolveMastraAgentArgs,
  requestContext: RequestContext | undefined,
): Promise<MastraMemory | null> {
  if (mastraAgent) return (await mastraAgent.getMemory({ requestContext })) ?? null;
  const resolver = options.memoryInstance;
  if (!resolver) return null;
  const instance = typeof resolver === 'function' ? await resolver(args) : resolver;
  if (!instance) return null;
  // Mirror Agent.getMemory: a Memory built without its own `storage` relies on the Mastra
  // instance for one. The agent path gets that via getMemory(); on the workflow/custom-generator
  // path we wire it here, so the worker's direct thread bootstrap + greeting persistence have a
  // storage provider instead of throwing "Memory requires a storage provider".
  instance.__registerMastra(options.mastra);
  if (!instance.hasOwnStorage) {
    const storage = options.mastra.getStorage();
    if (storage) instance.setStorage(storage);
  }
  return instance;
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
  if (options.generate && (options.agent || options.workflow)) {
    throw new Error(
      '@mastra/livekit: set exactly one reply generator — `generate`, `agent`, or `workflow` — not a combination.',
    );
  }
  if (options.agent && options.workflow) {
    throw new Error(
      '@mastra/livekit: set `agent` or `workflow`, not both — they are mutually exclusive reply generators.',
    );
  }
  if (options.workflow && !options.workflowInput) {
    throw new Error(
      '@mastra/livekit: `workflowInput` is required when `workflow` is set. Map the turn into the ' +
        'workflow inputData, e.g. workflowInput: ({ chatCtx }) => ({ history: chatContextToMessages(chatCtx) }).',
    );
  }

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

      // Resolve the per-turn reply generator. Precedence: an explicit `generate` function, then
      // a `workflow` (run-to-completion per turn), then a Mastra `agent` (the default).
      let mastraAgent: MastraAgent | undefined;
      let replyGenerator: VoiceReplyGenerator | undefined;
      let agentLabel: string;
      if (options.generate) {
        replyGenerator = options.generate;
        agentLabel = 'mastra-voice';
      } else if (options.workflow) {
        const { workflow } = await resolveWorkflow(options, args);
        agentLabel = workflow.id;
        const mapInput = options.workflowInput!;
        replyGenerator = createWorkflowReplyGenerator({
          workflow,
          workflowInput: turnCtx => mapInput({ ...turnCtx, metadata }),
          replyStep: options.replyStep,
          resultText: options.resultText,
          toolFeedback: options.toolFeedback,
          onTurnComplete: options.onTurnComplete,
        });
      } else {
        mastraAgent = await resolveMastraAgent(options, args);
        agentLabel = mastraAgent.id ?? mastraAgent.name;
      }

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
      // The memory instance backs up-front thread bootstrap and greeting persistence. With an
      // agent it comes from the agent; on the workflow/custom-generator path it comes from the
      // `memoryInstance` option. When neither is available it stays null and the generator owns
      // persistence (e.g. saveMessages inside a step).
      const memoryInstance = memory ? await resolveMemoryInstance(options, mastraAgent, args, requestContext) : null;
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
              agentId: agentLabel,
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

      // End-of-call hook: runs after the caller hangs up, awaited within LiveKit's shutdown grace
      // window so the work finishes before the process exits. Registered up front (like the
      // observability finalizer) so it still fires if session start fails. Errors are logged.
      if (options.onCallEnd) {
        const onCallEnd = options.onCallEnd;
        ctx.addShutdownCallback(async () => {
          try {
            await onCallEnd({ memory, memoryInstance, metadata, requestContext, roomName, ctx });
          } catch (error) {
            console.warn('@mastra/livekit: onCallEnd hook threw', error);
          }
        });
      }

      const agent = createMastraVoiceAgent({
        ...(replyGenerator ? { generate: replyGenerator } : { agent: mastraAgent! }),
        instructions: mastraAgent ? await resolveInstructions(mastraAgent, requestContext) : undefined,
        memory,
        requestContext,
        toolFeedback: options.toolFeedback,
        onTurnComplete: options.onTurnComplete,
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
