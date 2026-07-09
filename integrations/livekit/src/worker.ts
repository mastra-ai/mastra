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
  /**
   * The worker's `configuration` (greeting, consent requirements, …). Read it here to honor policy
   * at end-of-call — e.g. only flush a call summary to observational memory when
   * `configuration.consentPolicy.summaryStorage` isn't required, or the caller granted it.
   */
  configuration?: LiveKitWorkerConfiguration;
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
  /**
   * Speech-to-text: a LiveKit plugin instance or an inference model string like 'deepgram/nova-3'.
   * For per-call / per-tenant selection, set the `configuration.stt` resolver — it takes
   * precedence, with this option as the fallback.
   */
  stt?: voice.AgentSessionOptions['stt'];
  /**
   * Text-to-speech: a LiveKit plugin instance or an inference model string like 'cartesia/sonic-3'.
   * For per-call / per-tenant selection, set the `configuration.tts` resolver — it takes
   * precedence, with this option as the fallback.
   */
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
  /**
   * Grouped conversation & compliance configuration. Related policy knobs live here — rather than
   * as many top-level worker options — so this call stays flat as more are added. Today it carries
   * the greeting / AI-disclosure; it's the intended home for further compliance controls (recording
   * notice, periodic re-disclosure, data retention, human handoff, …). See
   * {@link LiveKitWorkerConfiguration}.
   */
  configuration?: LiveKitWorkerConfiguration;
  /**
   * Static greeting spoken when the session starts.
   *
   * @deprecated Prefer `configuration.greeting.text`. Still honored for backwards compatibility;
   * when `configuration.greeting` is also set, its fields take precedence.
   */
  greeting?: string;
  /**
   * Save the spoken greeting to the memory thread as an assistant message.
   *
   * @deprecated Prefer `configuration.greeting.persist`. Still honored for backwards compatibility.
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
 * Per-call context handed to the `configuration` resolvers (greeting text, STT, TTS) so they can
 * key per-call / per-tenant behavior off the call. Built post-connect, so the dispatch metadata,
 * request context, and room name are all available.
 */
export interface VoiceCallContext {
  /**
   * Dispatch metadata for the call — the per-tenant routing signal (dialed number, tenant/agent id,
   * thread/resource, and any `requestContext` entries) parsed from the LiveKit job metadata.
   */
  metadata: LiveKitSessionMetadata;
  /** The request context built from the dispatch metadata, if any. */
  requestContext?: RequestContext;
  /** The LiveKit room name. */
  roomName: string;
  /** The LiveKit job context, for anything the metadata doesn't carry. */
  ctx: JobContext;
}

/** Context handed to a greeting resolver. Alias of {@link VoiceCallContext}. */
export type GreetingContext = VoiceCallContext;

/**
 * A per-call resolver for a session component (STT / TTS): invoked once per call (post-connect)
 * with the call {@link VoiceCallContext}. Return `undefined` to fall back to the static top-level
 * option for that component.
 */
export type SessionComponentResolver<T> = (
  context: VoiceCallContext,
) => T | undefined | void | Promise<T | undefined | void>;

/**
 * The spoken greeting: a fixed string, or a resolver invoked once per call (post-connect) with the
 * call {@link GreetingContext}. Use the resolver form for a per-tenant greeting derived from the
 * dispatch metadata / request context — one multi-tenant agent, a different opening per tenant.
 * Return `undefined` (or empty) for no greeting on that call.
 */
export type GreetingText =
  | string
  | ((context: GreetingContext) => string | undefined | void | Promise<string | undefined | void>);

/**
 * The opening greeting spoken when the session starts — and the vehicle for a required AI
 * disclosure. Under the EU AI Act (Art. 50) a person interacting with an AI system must be told so
 * at the first interaction; set `allowInterruptions: false` so that disclosure can't be talked over.
 */
export interface GreetingConfiguration {
  /**
   * What is spoken when the session starts. A fixed string, or a resolver invoked once per call
   * (post-connect) with the call {@link GreetingContext} — return a per-tenant greeting built from
   * the dispatch metadata / request context (e.g. `` `Thanks for calling ${tenant}, you're speaking
   * with an AI assistant` ``). Omit, or return `undefined`, for no greeting.
   */
  text?: GreetingText;
  /**
   * Whether the caller can interrupt (barge over) the greeting. Defaults to LiveKit's behavior
   * (interruptible). Set `false` to make the greeting play through — e.g. when it carries a
   * disclosure the caller is legally required to hear ("you're speaking with an AI assistant"),
   * so they can't talk over it and miss it.
   */
  allowInterruptions?: boolean;
  /**
   * Wait for the greeting to finish playing before continuing (greeting persistence and
   * `onSessionStart`). Defaults to `false`. Pair with `allowInterruptions: false` when a
   * disclosure must fully play out before any post-greeting work runs.
   */
  awaitPlayout?: boolean;
  /**
   * Save the spoken greeting to the memory thread as an assistant message, so the saved thread is
   * a faithful call transcript. Defaults to `true`; only applies when memory is enabled.
   */
  persist?: boolean;
  /**
   * Periodically re-disclose the AI status on long calls (e.g. California SB 243). Once this many
   * milliseconds have elapsed since the last disclosure, the next turn's reply is prefixed with a
   * short reminder — spoken at the turn boundary, never mid-turn. Omit (or `0`) to disable. Example:
   * `repeatEvery: 3 * 60_000` re-discloses roughly every three minutes.
   *
   * CAVEAT: don't combine with `turnHandling.preemptiveGeneration`. The reminder clock resets when
   * the reminder is threaded into a reply stream; a speculative reply that gets discarded still
   * consumes the interval, so the next real turn can miss its re-disclosure. (Preemptive
   * generation is off by default and already incompatible with memory on this path.)
   */
  repeatEvery?: number;
  /** The short reminder spoken on each re-disclosure. Defaults to a generic AI-assistant reminder. */
  repeatText?: string;
}

/**
 * One consent item's requirement. `true` is shorthand for a required consent with defaults; the
 * object form carries the metadata a production consent record needs (whether it's required, and a
 * human-readable purpose for the spoken/logged prompt and the audit trail).
 */
export type ConsentRequirement =
  | boolean
  | {
      /** Whether the caller's consent is required for this item. Defaults to `true` when present. */
      required?: boolean;
      /**
       * Human-readable description of what is being consented to — for the spoken/logged consent
       * prompt and the stored consent record. E.g. "storing a summary of this call".
       */
      purpose?: string;
    };

/**
 * The call's consent policy, as a **named, extensible set** — each item independently required
 * and independently granted at runtime, rather than one global "consented" flag. New consent
 * items are added as named keys so the model grows without reshaping existing ones or conflating
 * unrelated permissions (a production consent model, not one-size-fits-all). Declaring a policy
 * enforces nothing by itself: capture the caller's grant at runtime with `createConsentTool`, and
 * enforce it in your own code (at `onCallEnd`, or before any consent-gated action).
 */
export interface ConsentConfiguration {
  /**
   * Consent to store a summary of the call (observational-memory distillation, CRM notes, etc.).
   * When required, persist a call summary only if the caller has granted this consent.
   */
  summaryStorage?: ConsentRequirement;
  // Further consent items (recording, dataSharing, marketing, …) are added as named keys here.
}

/**
 * Agent-initiated hang-up: let the agent end the call itself (say goodbye → hang up). Enable it here
 * and add a matching tool to the agent with `createEndCallTool` (both default to the tool name
 * `'endCall'`). The tool only signals intent — from inside `agent.stream()` it can't reach the room;
 * the worker owns the hang-up. On each turn the worker watches for the tool, waits for the agent's
 * closing words to finish playing (so the goodbye is never cut off), then disconnects — running
 * `onCallEnd` on the way out, exactly as a caller-initiated hang-up does. Works on the agent and
 * workflow reply paths.
 */
export interface EndCallConfiguration {
  /**
   * Name of the tool the agent calls to end the call — must match the `id` you gave
   * `createEndCallTool`. Defaults to `'endCall'`.
   */
  tool?: string;
  /**
   * Optional closing line spoken (non-interruptibly) right before hanging up, after the agent's own
   * final words finish. Use it for a guaranteed sign-off or a compliance closing. Omit to just hang
   * up once the agent's closing words finish playing.
   */
  message?: string;
  /** Reason recorded on the shutdown (shows up in LiveKit logs). Defaults to `'agent ended call'`. */
  reason?: string;
  /**
   * Safety cap in milliseconds on how long to wait for the agent's closing words to finish playing
   * before hanging up, in case the speaking state never clears. Defaults to `30000`.
   */
  maxWaitMs?: number;
}

/**
 * Grouped conversation & compliance configuration for {@link CreateLiveKitWorkerOptions.configuration}.
 * A single home for related policy knobs so they don't each become a top-level worker option. Today
 * it carries the greeting / AI-disclosure, consent requirements, agent-initiated hang-up, and
 * per-call STT/TTS selection; it's the intended landing spot for further compliance controls
 * (recording notice, data retention, …).
 */
export interface LiveKitWorkerConfiguration {
  /** The opening greeting / AI-disclosure, plus optional periodic re-disclosure. See {@link GreetingConfiguration}. */
  greeting?: GreetingConfiguration;
  /**
   * The call's consent policy. **Declarative only — the worker enforces nothing by itself.**
   * Capture grants at runtime with `createConsentTool`; enforce them in your own code. See
   * {@link ConsentConfiguration}.
   */
  consentPolicy?: ConsentConfiguration;
  /** Let the agent end the call itself (say goodbye → hang up). See {@link EndCallConfiguration}. */
  endCall?: EndCallConfiguration;
  /**
   * Per-call speech-to-text: a resolver invoked once per call (post-connect) with the call
   * {@link VoiceCallContext}, returning anything the top-level `stt` option accepts (a plugin
   * instance or an inference model string like `'deepgram/nova-3'`). Use it to pick the
   * transcriber per tenant or language off the dispatch metadata / request context. Return
   * `undefined` to fall back to the top-level `stt`. Runs during call setup, so keep it fast —
   * when it constructs plugin instances, cache them across calls (e.g. a `Map` keyed by tenant).
   */
  stt?: SessionComponentResolver<voice.AgentSessionOptions['stt']>;
  /**
   * Per-call text-to-speech: a resolver invoked once per call (post-connect) with the call
   * {@link VoiceCallContext}, returning anything the top-level `tts` option accepts (a plugin
   * instance or an inference model string like `'cartesia/sonic-3'`). Use it to give each tenant
   * its own voice / language. Return `undefined` to fall back to the top-level `tts`. Runs during
   * call setup, so keep it fast — when it constructs plugin instances, cache them across calls.
   */
  tts?: SessionComponentResolver<voice.AgentSessionOptions['tts']>;
}

/**
 * Resolves the effective greeting from the canonical `configuration.greeting` and the deprecated
 * top-level `greeting` / `persistGreeting` options. The legacy options are the base so existing
 * worker configs keep working unchanged; `configuration.greeting` overrides field-by-field. Exported
 * for unit testing.
 */
export function resolveGreetingConfig(
  options: Pick<CreateLiveKitWorkerOptions, 'greeting' | 'persistGreeting' | 'configuration'>,
): GreetingConfiguration {
  return {
    text: options.greeting,
    persist: options.persistGreeting,
    ...options.configuration?.greeting,
  };
}

/**
 * Resolves the greeting text for a call: returns a fixed string as-is, or invokes the resolver form
 * with the call context to produce a per-tenant greeting. Empty / whitespace-nothing results
 * normalize to `undefined` (no greeting). Exported for unit testing.
 */
export async function resolveGreetingText(
  text: GreetingText | undefined,
  context: GreetingContext,
): Promise<string | undefined> {
  const resolved = typeof text === 'function' ? await text(context) : text;
  return resolved || undefined;
}

/**
 * Resolves a per-call session component (STT / TTS): invokes the `configuration` resolver with the
 * call context, falling back to the static top-level option when there is no resolver or it
 * resolves to `undefined`. Exported for unit testing.
 */
export async function resolveSessionComponent<T>(
  resolver: SessionComponentResolver<T> | undefined,
  fallback: T | undefined,
  context: VoiceCallContext,
): Promise<T | undefined> {
  const resolved = resolver ? await resolver(context) : undefined;
  return resolved ?? fallback;
}

/** A {@link GreetingConfiguration} whose `text` resolver has been resolved to a plain string. */
type ResolvedGreetingConfiguration = Omit<GreetingConfiguration, 'text'> & { text?: string };

/**
 * Speaks the session's opening greeting, honoring the interruption / playout options. Takes the
 * already-resolved greeting (see {@link resolveGreetingText}) and returns the LiveKit `SpeechHandle`,
 * or `undefined` when there is no greeting text. Extracted and exported so the greeting behavior is
 * unit-testable without a live room.
 */
export async function speakGreeting(
  session: Pick<voice.AgentSession, 'say'>,
  greeting: ResolvedGreetingConfiguration,
): Promise<ReturnType<voice.AgentSession['say']> | undefined> {
  if (!greeting.text) return undefined;
  // Only pass a say-options object when we actually override a default, so an unset
  // `allowInterruptions` keeps LiveKit's own default rather than forcing a value.
  const handle = session.say(
    greeting.text,
    greeting.allowInterruptions === undefined ? undefined : { allowInterruptions: greeting.allowInterruptions },
  );
  if (greeting.awaitPlayout) {
    // waitForPlayout rejects if the greeting is interrupted; that's a normal outcome for an
    // interruptible greeting, not a session-level failure, so swallow it.
    await handle.waitForPlayout().catch(() => {});
  }
  return handle;
}

/** Default tool name the worker watches for to end the call. Matches `createEndCallTool`'s default. */
export const DEFAULT_END_CALL_TOOL = 'endCall';
/** Default shutdown reason recorded when the agent ends the call. */
export const DEFAULT_END_CALL_REASON = 'agent ended call';
/** Default safety cap on waiting for the agent's closing words to finish before hanging up. */
export const DEFAULT_END_CALL_MAX_WAIT_MS = 30_000;

/** Agent states where the agent is still busy producing / playing a reply (not done speaking). */
const AGENT_BUSY_STATES = new Set<voice.AgentState>(['thinking', 'speaking']);

/** The minimal logger surface these helpers use (the Mastra logger satisfies it). */
type WarnLogger = { warn: (message: string, ...args: unknown[]) => void };

/**
 * Resolves once the agent is no longer producing or playing a reply — i.e. its state has left
 * `thinking`/`speaking` for `listening`/`idle`. Returns immediately when it's already idle. A
 * `maxWaitMs` safety cap guarantees it resolves even if the speaking state never clears. Used before
 * an agent-initiated hang-up so the closing words play out fully instead of being cut off by the
 * session close. Exported for unit testing.
 */
export function waitForAgentDoneSpeaking(
  session: Pick<voice.AgentSession, 'agentState' | 'on' | 'off'>,
  maxWaitMs: number = DEFAULT_END_CALL_MAX_WAIT_MS,
): Promise<void> {
  if (!AGENT_BUSY_STATES.has(session.agentState)) return Promise.resolve();
  return new Promise<void>(resolve => {
    // Check-then-subscribe with no await in between, so a state change can't slip past unobserved.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (ev: voice.AgentStateChangedEvent) => {
      if (AGENT_BUSY_STATES.has(ev.newState)) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      session.off(voice.AgentSessionEventTypes.AgentStateChanged, onChange);
      if (timer) clearTimeout(timer);
    };
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, onChange);
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, maxWaitMs);
    // Don't let the safety timer keep the worker process alive on its own.
    (timer as { unref?: () => void }).unref?.();
  });
}

/**
 * Ends the call after the agent asked to (via its end-call tool): wait for the agent's closing words
 * to finish, speak an optional final `message`, then disconnect. The teardown's session close
 * force-interrupts any playing speech, so the waits here MUST complete before we disconnect — that's
 * the whole point of the sequence. `ctx.deleteRoom()` hangs up the caller (SIP-safe); `ctx.shutdown()`
 * ends the job and runs the registered shutdown callbacks (`onCallEnd`), so end-of-call work happens
 * exactly as it does on a caller hang-up. Both run in a `finally` so a hiccup while waiting still ends
 * the call. Never rejects — every step is guarded and failures are logged, so callers can safely
 * fire-and-forget it (`void runEndCall(...)`) from hooks. Exported for unit testing.
 */
export async function runEndCall(
  session: Pick<voice.AgentSession, 'agentState' | 'on' | 'off' | 'say'>,
  ctx: Pick<JobContext, 'deleteRoom' | 'shutdown'>,
  config: EndCallConfiguration,
  logger: WarnLogger,
): Promise<void> {
  try {
    await waitForAgentDoneSpeaking(session, config.maxWaitMs ?? DEFAULT_END_CALL_MAX_WAIT_MS);
    if (config.message) {
      // waitForPlayout rejects if interrupted; the closing line is non-interruptible, but swallow
      // anyway so a hiccup can't leave the call hanging.
      await session
        .say(config.message, { allowInterruptions: false })
        .waitForPlayout()
        .catch(() => {});
    }
  } catch (error) {
    logger.warn('@mastra/livekit: waiting for the agent to finish before ending the call failed', error);
  } finally {
    try {
      await ctx.deleteRoom();
    } catch (error) {
      logger.warn('@mastra/livekit: deleteRoom while ending the call failed', error);
    }
    try {
      ctx.shutdown(config.reason ?? DEFAULT_END_CALL_REASON);
    } catch (error) {
      logger.warn('@mastra/livekit: shutdown while ending the call failed', error);
    }
  }
}

/**
 * Builds the per-turn hook that detects the agent's end-call tool and kicks off the hang-up once, or
 * `undefined` when end-call isn't configured. The detector fires the teardown fire-and-forget (the
 * turn never waits on it) and de-dupes so a repeated tool call can't start two hang-ups.
 */
function buildEndCallDetector(
  config: EndCallConfiguration | undefined,
  getSession: () => Pick<voice.AgentSession, 'agentState' | 'on' | 'off' | 'say'> | undefined,
  ctx: Pick<JobContext, 'deleteRoom' | 'shutdown'>,
  logger: WarnLogger,
): VoiceTurnCompleteHook | undefined {
  if (!config) return undefined;
  const toolName = config.tool ?? DEFAULT_END_CALL_TOOL;
  let triggered = false;
  return turnCtx => {
    if (triggered) return;
    if (!turnCtx.result.toolCalls.some(call => call.toolName === toolName)) return;
    const session = getSession();
    if (!session) return;
    triggered = true;
    void runEndCall(session, ctx, config, logger);
  };
}

/** Runs the worker's own turn-complete detector alongside the user's `onTurnComplete`, if any. */
function composeTurnComplete(
  user: VoiceTurnCompleteHook | undefined,
  detector: VoiceTurnCompleteHook | undefined,
): VoiceTurnCompleteHook | undefined {
  if (!detector) return user;
  return ctx => {
    // The detector is fire-and-forget (it kicks off the hang-up itself); don't couple the user's
    // hook to it.
    void detector(ctx);
    return user?.(ctx);
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
 * import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
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
  if (options.generate && options.configuration?.endCall) {
    throw new Error(
      '@mastra/livekit: `configuration.endCall` has no effect with `generate` — the worker cannot observe ' +
        'tool calls from a custom reply generator. Detect the end-call tool inside your generator and call ' +
        '`runEndCall` directly instead.',
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
      // Route degradation warnings through the Mastra logger so they honor the app's
      // configured log level and transports instead of writing straight to the console.
      const logger = options.mastra.getLogger();
      const metadata = parseSessionMetadata(ctx.job.metadata);
      const args: ResolveMastraAgentArgs = { metadata, ctx };
      const requestContext = metadata.requestContext
        ? new RequestContext<unknown>(Object.entries(metadata.requestContext))
        : undefined;

      // Agent-initiated hang-up: watch each turn for the end-call tool, then (once) wait for the
      // agent's closing words to play out and disconnect. Composed with the user's onTurnComplete
      // before the reply generator is built, because each path owns its hook differently: the
      // workflow generator bakes it in at creation, the agent path threads it through the bridge.
      // The closure reads `session`, assigned below before any turn runs.
      const endCallDetector = buildEndCallDetector(options.configuration?.endCall, () => session, ctx, logger);
      const onTurnComplete = composeTurnComplete(options.onTurnComplete, endCallDetector);

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
          onTurnComplete,
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
          logger.warn('@mastra/livekit: failed to create the voice call thread', error);
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
            await onCallEnd({
              memory,
              memoryInstance,
              metadata,
              requestContext,
              configuration: options.configuration,
              roomName,
              ctx,
            });
          } catch (error) {
            logger.warn('@mastra/livekit: onCallEnd hook threw', error);
          }
        });
      }

      // Resolve the greeting: `configuration.greeting` is canonical, but the deprecated top-level
      // `greeting` / `persistGreeting` options are still honored (additive), configuration winning.
      const greetingConfig = resolveGreetingConfig(options);
      // Periodic AI re-disclosure (disabled unless a positive interval is set). Handled at the turn
      // boundary inside the voice agent, so it works on the agent and workflow/custom paths alike.
      const greetingReminder =
        greetingConfig.repeatEvery && greetingConfig.repeatEvery > 0
          ? { everyMs: greetingConfig.repeatEvery, text: greetingConfig.repeatText }
          : undefined;

      const agent = createMastraVoiceAgent({
        ...(replyGenerator ? { generate: replyGenerator } : { agent: mastraAgent! }),
        instructions: mastraAgent ? await resolveInstructions(mastraAgent, requestContext) : undefined,
        memory,
        requestContext,
        toolFeedback: options.toolFeedback,
        onTurnComplete,
        greetingReminder,
        streamOptions: voiceObs ? { tracingContext: voiceObs.tracingContext } : undefined,
      });

      // Per-call STT/TTS: the `configuration.stt` / `configuration.tts` resolvers pick this
      // call's transcriber and voice (per-tenant voices/languages keyed off the dispatch
      // metadata), falling back to the static top-level options. The same context feeds the
      // greeting resolver below.
      const callContext: VoiceCallContext = { metadata, requestContext, roomName, ctx };
      const [stt, tts] = await Promise.all([
        resolveSessionComponent(options.configuration?.stt, options.stt, callContext),
        resolveSessionComponent(options.configuration?.tts, options.tts, callContext),
      ]);

      const session = new voice.AgentSession({
        stt,
        tts,
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

        if (greetingConfig.text) {
          // Resolve the greeting once (a fixed string, or a per-tenant resolver run post-connect),
          // then use that same resolved text for both speaking and persistence.
          const greetingText = await resolveGreetingText(greetingConfig.text, callContext);
          if (greetingText) {
            await speakGreeting(session, { ...greetingConfig, text: greetingText });
            if (greetingConfig.persist !== false && memory && memoryInstance) {
              try {
                await persistSpokenGreeting({
                  memory: memoryInstance,
                  threadId: memory.thread,
                  resourceId: memory.resource ?? memory.thread,
                  greeting: greetingText,
                });
              } catch (error) {
                logger.warn('@mastra/livekit: failed to persist the greeting', error);
              }
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
