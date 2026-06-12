import { MastraError } from '../../error/index.js';
import { RETHROWN_TOOL_ERROR_NAMES } from '../../loop/workflows/errors';
import { SpanType } from '../../observability';
import type { SpanRecord } from '../../storage/domains/observability/tracing';
import type { ToolHooks } from '../../tools/types';
import { deepEqual } from '../../utils';

/**
 * Tool replay for dataset experiments.
 *
 * Replays tool outputs recorded in a prior traced run instead of executing
 * live tools: tool spans from the source trace are turned into per-tool FIFO
 * queues, and a `beforeToolCall` hook short-circuits each matching call with
 * the recorded output (or re-throws the recorded error). The agent's own
 * behavior stays free to diverge — divergence is reported, not prevented.
 *
 * Short-circuited calls appear in the replay run's own trace as synthetic
 * TOOL_CALL spans flagged `metadata.toolReplay.synthetic: true` (recorded by
 * the agent's hook wrapper); extraction skips them so a replay run's trace
 * can never serve as a recording.
 */

/** One recorded tool invocation derived from a trace tool span. */
export interface ToolReplayEvent {
  /** Tool name as exposed to the model (span entityName/entityId). */
  toolName: string;
  /** Recorded tool args — used for divergence diagnostics only, never for matching. */
  input: unknown;
  /** Recorded tool output (undefined when the recorded call errored). */
  output: unknown;
  /** Recorded tool error, normalized. Replay re-throws it so the agent sees the same failure. */
  error: { name?: string; message: string } | null;
  /** Source span ID in the recorded trace. */
  spanId: string;
  /** Position of this event in the recorded trace (0-based, across all tools). */
  sequence: number;
  startedAt: Date;
}

/** Behavior when a tool call has no remaining recorded event. */
export type ToolReplayOnMiss = 'error' | 'passthrough';

/**
 * How recorded events are matched to the agent's calls.
 * - `'fifo'` (default): per-tool order — the next recorded event for the tool
 *   is served regardless of args; arg drift is reported, not prevented. Right
 *   for evaluating a *changed* agent, which reformulates args by nature.
 * - `'strict'`: per-tool lookup by canonicalized args — an event is served
 *   only when the call's args exactly match a recorded call's args; anything
 *   else is a miss. Right for contract-style tests where deviation must fail.
 *   `argMismatches` is empty by construction in this mode.
 */
export type ToolReplayMatching = 'fifo' | 'strict';

/** Assertion attached to a tool mock — evaluated after the run completes. */
export interface ToolMockExpectation {
  /**
   * Args the agent is expected to call the tool with (canonicalized deep
   * equality; runtime-injected nullish keys are ignored). When set,
   * `calledTimes` counts only calls with matching args.
   */
  args?: unknown;
  /**
   * Exact number of (matching) calls required. Omitted → at least one.
   * `0` asserts the tool must NOT be called (with those args, if set).
   */
  calledTimes?: number;
}

/** One args-conditional answer in a data mock's `cases` table. */
export interface ToolMockCase {
  /**
   * Args this case answers — canonicalized deep equality, like strict
   * matching (runtime-injected nullish keys are ignored).
   */
  args: unknown;
  /** Output served when the case matches. */
  output?: unknown;
  /** Error thrown when the case matches (wins over `output`, like the top-level pair). */
  error?: { name?: string; message: string };
}

/**
 * Data-shaped tool mock: a static stub (`output`), an injected failure
 * (`error`), an args-conditional answer table (`cases`), an assertion
 * (`expect`), or combinations. An entry with only `expect` doesn't stub
 * anything — the call executes normally (replayed or live) and only the
 * assertion is recorded.
 */
export interface ToolMockDataConfig {
  /** Static output returned for every call — the tool never executes. */
  output?: unknown;
  /** Error thrown for every call (failure injection) — the tool never executes. */
  error?: { name?: string; message: string };
  /**
   * Args-conditional answers: the first case whose `args` match the call's
   * args serves its output (or throws its error). Mutually exclusive with the
   * static `output`/`error` pair — a mock is either static or conditional.
   * `expect` combines freely and counts every call, matched or not.
   */
  cases?: ToolMockCase[];
  /**
   * Behavior when no case matches the call's args (default: 'error').
   * 'error' aborts the attempt deterministically (TOOL_MOCK_ARGS_MISMATCH,
   * never retried — same semantics as a replay miss under onMiss: 'error');
   * 'passthrough' lets the live tool execute.
   */
  onNoMatch?: 'error' | 'passthrough';
  expect?: ToolMockExpectation;
}

/**
 * Function mock: replaces the tool's execute entirely. Code-only — functions
 * cannot cross the HTTP API (Studio and clients can only send data mocks).
 *
 * A thrown error (or rejected promise) propagates exactly like a throwing
 * live `execute` — unlike `{ error }` data mocks, the error name is NOT
 * sanitized against the loop's rethrown-name list, so reserved names abort
 * the run instead of becoming a model-visible tool error. The call is
 * recorded in `calls[]` with outcome 'mock-error'.
 */
export type ToolMockFunction = (call: { input: unknown; callIndex: number }) => Promise<unknown> | unknown;

export type ToolMockConfig = ToolMockDataConfig | ToolMockFunction;

/** Per-tool mock usage accounting, included in the report. */
export interface ToolMockUsage {
  toolName: string;
  calls: number;
  /**
   * Static classification of the mock config, not a per-call record.
   * 'observe' = expect-only entry (calls executed normally). When a data mock
   * sets both `output` and `error`, the error wins on every call ('error').
   * 'cases' = args-conditional table (per-call answers are in `calls[]`).
   */
  kind: 'output' | 'error' | 'cases' | 'function' | 'observe';
}

/** Outcome of one ToolMockExpectation, included in the report. */
export interface ToolMockExpectationResult {
  toolName: string;
  satisfied: boolean;
  /** Calls counted against the expectation (arg-filtered when expect.args is set). */
  calledTimes: number;
  reason?: string;
}

/**
 * One tool call the run actually made, in hook-arrival order — the run's
 * call flow. Lets consumers reconstruct "what happened, step by step" and
 * diff it against the recording (replayed entries carry the consumed
 * recorded event's `sequence`).
 */
export interface ToolReplayCall {
  /** 0-based arrival order across all tools. Parallel calls in one step keep hook-arrival order. */
  order: number;
  toolName: string;
  outcome:
    | 'replayed' // recorded output served
    | 'replayed-error' // recorded error re-thrown
    | 'mocked' // mock output / function result / matched case served
    | 'mock-error' // mock error injected (static or matched case)
    | 'miss-error' // no event left, item stopped
    | 'miss-passthrough' // no event left, live tool executed
    | 'case-miss-error' // cases mock matched nothing, item stopped (onNoMatch: 'error')
    | 'case-miss-passthrough' // cases mock matched nothing, live tool executed
    | 'live'; // mock-only run, unmocked tool executed live
  /** Recorded event consumed (replayed outcomes only). */
  sequence?: number;
  /** FIFO mode only: args differed from the consumed recorded event. */
  argsDiffered?: boolean;
  /** Cases mocks only: index of the case that answered the call. */
  caseIndex?: number;
}

export interface ToolReplayMiss {
  toolName: string;
  /** What happened: 'passthrough' = live execution proceeded, 'error' = the run was aborted. */
  action: ToolReplayOnMiss;
  /** Args of the unmatched call, for diagnostics. */
  input?: unknown;
}

export interface ToolReplayArgMismatch {
  toolName: string;
  /** Sequence of the recorded event that was replayed despite differing args. */
  sequence: number;
  spanId: string;
}

/**
 * Divergence summary for one item attempt. Divergence is signal: it shows how
 * the agent's trajectory differed from the recorded run even though every
 * matched call returned identical observations.
 */
export interface ToolReplayReport {
  /** Trace the events were derived from (null when no recording was found for the item). */
  sourceTraceId: string | null;
  /** Total recorded events available for replay. */
  totalRecorded: number;
  /** Events consumed by the agent (including replayed errors). */
  replayedCount: number;
  /** Live calls that had no recorded event remaining. */
  misses: ToolReplayMiss[];
  /** Recorded events never consumed — the agent didn't request them, or a mock intercepted the calls. */
  unconsumed: { toolName: string; count: number }[];
  /** Calls replayed in order but with args differing from the recording (diagnostic only). */
  argMismatches: ToolReplayArgMismatch[];
  /**
   * Number of recorded payloads containing the sensitive-data redaction marker.
   * Redacted recordings replay redacted values — a non-zero count means the
   * agent received '[REDACTED]' strings instead of the original data.
   */
  redactedPayloadCount?: number;
  /**
   * True when the recording came from a different version of this dataset item
   * (the item was edited after the recording) — old observations are paired
   * with the item's new input.
   */
  staleRecording?: boolean;
  /**
   * The run's actual call flow, in order — what each call was answered by.
   * Lets consumers diff the run against the recording step by step.
   */
  calls?: ToolReplayCall[];
  /** Mock usage accounting — present when toolMocks were configured. */
  mocks?: ToolMockUsage[];
  /**
   * Expectation outcomes — present when any mock carried an `expect`.
   * Any unsatisfied entry fails the item (TOOL_MOCK_EXPECTATION_FAILED).
   */
  expectations?: ToolMockExpectationResult[];
}

/** Mutable per-attempt replay state. Create a fresh one for every execution attempt. */
export interface ToolReplayState {
  /** Remaining (unconsumed) events per tool, in recorded order. */
  queues: Map<string, ToolReplayEvent[]>;
  sourceTraceId: string | null;
  totalRecorded: number;
  replayedCount: number;
  misses: ToolReplayMiss[];
  argMismatches: ToolReplayArgMismatch[];
  /** Recorded payloads containing the sensitive-data redaction marker. */
  redactedPayloadCount: number;
  matching: ToolReplayMatching;
  /**
   * False when only toolMocks are configured (no replay source): unmocked
   * tools then execute live instead of missing against empty queues.
   */
  replayActive: boolean;
  /** Mocks keyed by formatted tool name, with per-call accounting. */
  mocks: Map<string, { toolName: string; config: ToolMockConfig; calls: { input: unknown }[] }>;
  /** The run's call flow, appended at each hook arrival. */
  calls: ToolReplayCall[];
}

const TOOL_SPAN_TYPES: ReadonlySet<SpanType> = new Set([SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL]);

// Note: the test regex must NOT carry the global flag — a global regex is
// stateful under .test() (lastIndex) and would alternate results across calls.
const INVALID_TOOL_NAME_CHAR_TEST_REGEX = /[^a-zA-Z0-9_\-]/;
const VALID_TOOL_NAME_STARTING_CHAR_REGEX = /^[a-zA-Z_]/;

/**
 * Mirror of the agent's tool-name formatting (`Agent.formatTools`): the model
 * (and therefore the hook context) sees formatted names, while tool spans
 * record the tool's original name. Queue keys and hook lookups are normalized
 * with the same rule so they match. Idempotent for already-valid names.
 */
function formatToolName(name: string): string {
  if (
    name.length <= 63 &&
    VALID_TOOL_NAME_STARTING_CHAR_REGEX.test(name) &&
    !INVALID_TOOL_NAME_CHAR_TEST_REGEX.test(name)
  ) {
    return name;
  }
  let formatted = name.replace(new RegExp(INVALID_TOOL_NAME_CHAR_TEST_REGEX, 'g'), '_');
  if (!VALID_TOOL_NAME_STARTING_CHAR_REGEX.test(formatted)) {
    formatted = `_${formatted}`;
  }
  return formatted.slice(0, 63);
}

function isToolSpan(span: SpanRecord): boolean {
  return TOOL_SPAN_TYPES.has(span.spanType) && !span.isEvent;
}

/**
 * True for synthetic tool spans the agent records when a `beforeToolCall`
 * hook short-circuits the call (see `Agent.recordShortCircuitedToolSpan`).
 * They carry `metadata.toolReplay.synthetic: true` and represent a served
 * recording or mock, not an execution — extracting them would let a replay
 * run's own trace masquerade as a recording. Shape-checked defensively:
 * metadata is user-writable, so anything that isn't the exact marker shape
 * stays extractable.
 */
function isSyntheticToolSpan(span: SpanRecord): boolean {
  const metadata = span.metadata;
  if (metadata == null || typeof metadata !== 'object') return false;
  const toolReplay = (metadata as Record<string, unknown>).toolReplay;
  if (toolReplay == null || typeof toolReplay !== 'object') return false;
  return (toolReplay as Record<string, unknown>).synthetic === true;
}

/**
 * True when the span has another tool span anywhere in its ancestor chain.
 * Such spans belong to nested executions (sub-agents via agent-as-tool,
 * workflow-as-tool internals) that the top-level replay hooks never intercept —
 * including them would poison the FIFO queues.
 */
function hasToolSpanAncestor(span: SpanRecord, spansById: Map<string, SpanRecord>): boolean {
  const visited = new Set<string>([span.spanId]);
  let parentId = span.parentSpanId;
  while (parentId) {
    if (visited.has(parentId)) return false; // cycle guard — treat as top-level
    visited.add(parentId);
    const parent = spansById.get(parentId);
    if (!parent) return false;
    if (isToolSpan(parent)) return true;
    parentId = parent.parentSpanId;
  }
  return false;
}

function normalizeSpanError(error: unknown): { name?: string; message: string } | null {
  if (error == null) return null;
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    let message: string;
    if (typeof err.message === 'string') {
      message = err.message;
    } else if (typeof err.text === 'string') {
      message = err.text;
    } else {
      // JSON.stringify throws on circular references and BigInt values —
      // degrade to a generic message instead of failing extraction.
      try {
        message = JSON.stringify(error) ?? 'Unknown tool error';
      } catch {
        message = 'Unknown tool error';
      }
    }
    return {
      ...(typeof err.name === 'string' ? { name: err.name } : {}),
      message,
    };
  }
  return { message: String(error) };
}

/**
 * Extract the ordered, top-level tool invocations from a recorded trace.
 *
 * Walks the raw span records directly (rather than reusing
 * `extractTrajectoryFromTrace`) so recorded errors and payloads are preserved
 * verbatim. Nested tool spans (sub-agent / workflow-as-tool internals) are
 * excluded — only calls the top-level agent made are replayable.
 */
export function extractToolReplayEvents(spans: SpanRecord[]): ToolReplayEvent[] {
  const spansById = new Map<string, SpanRecord>();
  for (const span of spans) {
    spansById.set(span.spanId, span);
  }

  const toolSpans = spans.filter(
    span =>
      isToolSpan(span) &&
      // Exporters persist span creates immediately, so a crashed or still-running
      // recorded run leaves tool spans with endedAt null and no output. Replaying
      // those would feed the agent fabricated empty observations — skip them; the
      // resulting miss (or unconsumed gap) is visible in the report instead.
      span.endedAt != null &&
      // Synthetic spans record served recordings/mocks, not executions — a
      // replay run's trace must never serve as a recording, even when pointed
      // at directly via replayTraceId.
      !isSyntheticToolSpan(span) &&
      !hasToolSpanAncestor(span, spansById),
  );

  // Adapter sort order is not contractual — order by startedAt defensively.
  // startedAt has ms resolution, so parallel calls can tie; break ties by
  // spanId (ordinal comparison — localeCompare is locale-sensitive) so the
  // FIFO order is identical across storage adapters.
  toolSpans.sort((a, b) => {
    const diff = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    if (diff !== 0) return diff;
    return a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0;
  });

  const events: ToolReplayEvent[] = [];
  for (const span of toolSpans) {
    // `||` not `??`: an empty-string entityName should fall back to entityId
    // rather than dropping the event.
    const toolName = span.entityName || span.entityId;
    if (!toolName) continue;
    events.push({
      toolName,
      input: span.input,
      output: span.output,
      error: normalizeSpanError(span.error),
      spanId: span.spanId,
      sequence: events.length,
      startedAt: new Date(span.startedAt),
    });
  }
  return events;
}

/**
 * Misses persist their args for diagnostics — the one unbounded payload in the
 * stored report (realistic under onMiss: 'passthrough' with many misses).
 * Document-capped stores break first (MongoDB 16MB/doc), so oversized inputs
 * persist as a marked preview instead of the full value.
 */
const MAX_MISS_INPUT_CHARS = 4096;

function capMissInput(input: unknown): unknown {
  if (input === undefined) return undefined;
  try {
    const serialized = JSON.stringify(input) ?? '';
    if (serialized.length <= MAX_MISS_INPUT_CHARS) return input;
    return { __truncated: true, originalChars: serialized.length, preview: serialized.slice(0, MAX_MISS_INPUT_CHARS) };
  } catch {
    return '[unserializable input]';
  }
}

/** Marker the SensitiveDataFilter span processor writes over redacted fields. */
const REDACTION_MARKER = '[REDACTED]';

function containsRedactionMarker(payload: unknown): boolean {
  if (payload == null) return false;
  try {
    return (JSON.stringify(payload) ?? '').includes(REDACTION_MARKER);
  } catch {
    return false;
  }
}

/**
 * Persisted stand-in for a function mock in the stamped marker — code cannot
 * be serialized, so the record shows that the tool was function-mocked and
 * nothing more.
 */
export interface ToolMockFunctionMarker {
  function: true;
}

/**
 * The marker the experiment runner stamps into `experiment.metadata.toolReplay`
 * on replay/mock runs. `onMiss` is present on replay runs; `mockedTools` lists
 * suppressing mocks on mock runs; either may appear alone or combined.
 * `mockConfigs` carries the mock configuration itself whenever the run is
 * stamped and mocks were configured.
 */
export interface ToolReplayExperimentMarker {
  fromExperimentId?: string;
  onMiss?: ToolReplayOnMiss;
  matching?: ToolReplayMatching;
  mockedTools?: string[];
  /**
   * Mock configs as configured, keyed by the user's tool name: data mocks
   * verbatim (output/error/cases/onNoMatch/expect), function mocks as
   * `{ function: true }` placeholders. Makes mock runs auditable and
   * re-runnable from the stored record alone — `mockedTools` stays the cheap
   * display field.
   */
  mockConfigs?: Record<string, ToolMockDataConfig | ToolMockFunctionMarker>;
}

/**
 * Parse the runner-stamped replay/mock marker out of experiment metadata.
 * Exact-shape check: a user-owned `toolReplay` metadata key that is not the
 * stamped shape (an object carrying `onMiss` or `mockedTools`) returns null,
 * so live runs can never be misclassified. The single source of truth for the
 * duck-typing the runner's source-guard and every UI/SDK consumer need.
 */
export function getToolReplayMarker(
  metadata: Record<string, unknown> | null | undefined,
): ToolReplayExperimentMarker | null {
  const candidate = metadata?.toolReplay;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null;
  if (!('onMiss' in candidate) && !('mockedTools' in candidate)) return null;
  const raw = candidate as Record<string, unknown>;
  return {
    ...(typeof raw.fromExperimentId === 'string' ? { fromExperimentId: raw.fromExperimentId } : {}),
    ...(raw.onMiss === 'error' || raw.onMiss === 'passthrough' ? { onMiss: raw.onMiss } : {}),
    ...(raw.matching === 'fifo' || raw.matching === 'strict' ? { matching: raw.matching } : {}),
    ...(Array.isArray(raw.mockedTools) ? { mockedTools: raw.mockedTools.filter(t => typeof t === 'string') } : {}),
    // Per-tool configs must be plain objects; anything else under a user-owned
    // metadata key is junk and is dropped, never surfaced as a config.
    ...(isPlainObject(raw.mockConfigs)
      ? {
          mockConfigs: Object.fromEntries(
            Object.entries(raw.mockConfigs).filter(([, value]) => isPlainObject(value)),
          ) as Record<string, ToolMockDataConfig | ToolMockFunctionMarker>,
        }
      : {}),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A mock that answers calls itself (output stub, error injection, case table,
 * or function replacement) — the live tool never executes for answered calls.
 * Expect-only entries observe and fall through. Suppressing mocks drive the
 * metadata stamp AND the strict unconsumed-contract exemption: a tool the
 * user explicitly took out of the contract cannot fail it. Cases mocks count
 * even with onNoMatch: 'passthrough' — matched calls are still answered.
 */
export function isSuppressingMock(config: ToolMockConfig): boolean {
  return typeof config === 'function' || Boolean(config.error) || 'output' in config || config.cases !== undefined;
}

/**
 * Refuse misconfigured case tables. A case table that silently never matches
 * (or half-answers) would corrupt the run instead of failing it, so the same
 * setup gate that catches name collisions catches these. Data mocks can cross
 * the HTTP API as JSON, so the shape is checked at runtime, not trusted.
 */
function validateToolMockCases(toolName: string, config: ToolMockConfig): void {
  if (typeof config === 'function' || config.cases === undefined) return;
  if (!Array.isArray(config.cases) || config.cases.length === 0) {
    throw new MastraError({
      id: 'TOOL_MOCK_INVALID_CASES',
      text: `toolMocks entry '${toolName}' needs a non-empty cases array`,
      domain: 'STORAGE',
      category: 'USER',
    });
  }
  if ('output' in config || config.error) {
    throw new MastraError({
      id: 'TOOL_MOCK_INVALID_CASES',
      text: `toolMocks entry '${toolName}' sets cases together with a static output/error — a mock is either static or conditional; move the static answer into a case`,
      domain: 'STORAGE',
      category: 'USER',
    });
  }
  config.cases.forEach((caseConfig, index) => {
    // Same at-least-one rule as a static mock, per case: a matched case must
    // answer with an output or an error.
    if (caseConfig === null || typeof caseConfig !== 'object' || (!('output' in caseConfig) && !caseConfig.error)) {
      throw new MastraError({
        id: 'TOOL_MOCK_INVALID_CASES',
        text: `toolMocks entry '${toolName}' cases[${index}] needs an output or error to answer matching calls`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
  });
}

/**
 * Map each toolMocks key to its agent-formatted tool name, refusing keys that
 * collide after formatting and case tables that are misconfigured. A silently
 * dropped mock means a silently skipped assertion — the exact failure class
 * mocks exist to eliminate — so the runner calls this at setup to fail the
 * experiment before any item runs.
 */
export function validateToolMockNames(mocks: Record<string, ToolMockConfig>): Map<string, string> {
  const keysBySource = new Map<string, string>();
  const sourcesByKey = new Map<string, string>();
  for (const toolName of Object.keys(mocks)) {
    validateToolMockCases(toolName, mocks[toolName]!);
    const key = formatToolName(toolName);
    const existing = sourcesByKey.get(key);
    if (existing !== undefined) {
      throw new MastraError({
        id: 'TOOL_MOCK_NAME_COLLISION',
        text: `toolMocks entries '${existing}' and '${toolName}' both normalize to tool name '${key}' — merge them into one entry`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    sourcesByKey.set(key, toolName);
    keysBySource.set(toolName, key);
  }
  return keysBySource;
}

/**
 * Fresh per-attempt state: per-tool FIFO queues plus report accumulators.
 * Queue keys are formatted tool names — spans record original tool names while
 * the hook context carries the agent-formatted name, so both sides normalize
 * through {@link formatToolName} to match.
 */
export function createReplayState(
  events: ToolReplayEvent[],
  sourceTraceId: string | null,
  options?: {
    matching?: ToolReplayMatching;
    /** Defaults to true; pass false for mock-only runs (no replay source). */
    replayActive?: boolean;
    mocks?: Record<string, ToolMockConfig>;
  },
): ToolReplayState {
  const queues = new Map<string, ToolReplayEvent[]>();
  let redactedPayloadCount = 0;
  for (const event of events) {
    const key = formatToolName(event.toolName);
    const queue = queues.get(key);
    if (queue) {
      queue.push(event);
    } else {
      queues.set(key, [event]);
    }
    if (containsRedactionMarker(event.input) || containsRedactionMarker(event.output)) {
      redactedPayloadCount++;
    }
  }
  const mocks = new Map<string, { toolName: string; config: ToolMockConfig; calls: { input: unknown }[] }>();
  for (const [toolName, key] of validateToolMockNames(options?.mocks ?? {})) {
    // Report under the formatted name so mocks[]/expectations[] stay joinable
    // with misses[]/calls[], which carry the agent-formatted hook name.
    mocks.set(key, { toolName: key, config: options!.mocks![toolName]!, calls: [] });
  }
  return {
    queues,
    sourceTraceId,
    totalRecorded: events.length,
    replayedCount: 0,
    misses: [],
    argMismatches: [],
    redactedPayloadCount,
    matching: options?.matching ?? 'fifo',
    replayActive: options?.replayActive ?? true,
    mocks,
    calls: [],
  };
}

/**
 * Override keys the tool builder splices into every tool's args schema
 * (background runs and suspend/resume — see tools/tool-builder/builder.ts).
 * Models routinely emit them as nulls, and capture points differ on whether
 * they're present, so nullish values are ignored when diagnosing arg drift —
 * `{ city: 'Paris' }` recorded vs `{ city: 'Paris', _background: null }`
 * requested is the same question. Non-null values (e.g. `_background: true`)
 * still compare: they change execution semantics.
 */
const RUNTIME_INJECTED_ARG_KEYS = ['_background', 'suspendedToolRunId', 'resumeData'] as const;

function normalizeArgsForComparison(args: unknown): unknown {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return args;
  const normalized = { ...(args as Record<string, unknown>) };
  for (const key of RUNTIME_INJECTED_ARG_KEYS) {
    if (key in normalized && normalized[key] == null) delete normalized[key];
  }
  return normalized;
}

/**
 * Build per-execution ToolHooks that replay recorded events.
 *
 * Matching is per-tool FIFO: the next unconsumed event for the called tool is
 * returned regardless of args, which tolerates cross-tool reordering and
 * repeated same-tool calls. Args that differ from the recording are flagged in
 * the report but still replayed.
 *
 * A thrown error from `beforeToolCall` surfaces to the model as a tool-error
 * result (the agent keeps running), so `onMiss: 'error'` alone cannot fail the
 * item — `onFatalMiss` lets the caller abort the run (e.g. via AbortController).
 * `onFatalCaseMiss` is the same mechanism for a cases mock whose table matched
 * nothing under `onNoMatch: 'error'`.
 */
export function buildReplayHooks(
  state: ToolReplayState,
  options: {
    onMiss: ToolReplayOnMiss;
    onFatalMiss?: (error: Error) => void;
    onFatalCaseMiss?: (error: Error) => void;
  },
): ToolHooks {
  return {
    beforeToolCall: async ({ toolName, input }) => {
      const key = formatToolName(toolName);

      // Mocks take precedence over the replay queues, per tool. An expect-only
      // entry records the call and falls through to replay/live execution.
      const mock = state.mocks.get(key);
      if (mock) {
        mock.calls.push({ input });
        if (typeof mock.config === 'function') {
          // Allocate the entry before suspending (keeps arrival order), then
          // settle the outcome — a rejecting replacement is a mock-error.
          const call: ToolReplayCall = { order: state.calls.length, toolName, outcome: 'mocked' };
          state.calls.push(call);
          try {
            const output = await mock.config({ input, callIndex: mock.calls.length - 1 });
            return { proceed: false, output, spanMetadata: { outcome: 'mocked' } };
          } catch (error) {
            call.outcome = 'mock-error';
            throw error;
          }
        }
        if (mock.config.cases) {
          // First case whose args match answers the call — duplicate-args
          // cases never reach the later entries. Same canonicalized
          // comparison as strict matching.
          const normalizedInput = normalizeArgsForComparison(input);
          const caseIndex = mock.config.cases.findIndex(candidate =>
            deepEqual(normalizedInput, normalizeArgsForComparison(candidate.args)),
          );
          if (caseIndex >= 0) {
            const matched = mock.config.cases[caseIndex]!;
            if (matched.error) {
              const error = new Error(matched.error.message);
              // Same guard as static mock errors below.
              if (matched.error.name && !RETHROWN_TOOL_ERROR_NAMES.has(matched.error.name)) {
                error.name = matched.error.name;
              }
              state.calls.push({ order: state.calls.length, toolName, outcome: 'mock-error', caseIndex });
              throw error;
            }
            state.calls.push({ order: state.calls.length, toolName, outcome: 'mocked', caseIndex });
            return { proceed: false, output: matched.output, spanMetadata: { outcome: 'mocked', caseIndex } };
          }
          if ((mock.config.onNoMatch ?? 'error') === 'passthrough') {
            state.calls.push({ order: state.calls.length, toolName, outcome: 'case-miss-passthrough' });
            return; // proceed with live execution
          }
          // Like a replay miss under onMiss: 'error' — deterministic, so the
          // attempt is aborted ("aborted" also suppresses the retry loop).
          state.calls.push({ order: state.calls.length, toolName, outcome: 'case-miss-error' });
          const error = new Error(
            `Tool mock case miss for '${toolName}': no case matches the call's args — execution aborted (onNoMatch: 'error')`,
          );
          options.onFatalCaseMiss?.(error);
          throw error;
        }
        if (mock.config.error) {
          const error = new Error(mock.config.error.message);
          // Same guard as replayed errors: never reuse names the tool-call
          // step re-throws instead of converting to a tool-error result.
          if (mock.config.error.name && !RETHROWN_TOOL_ERROR_NAMES.has(mock.config.error.name)) {
            error.name = mock.config.error.name;
          }
          state.calls.push({ order: state.calls.length, toolName, outcome: 'mock-error' });
          throw error;
        }
        if ('output' in mock.config) {
          state.calls.push({ order: state.calls.length, toolName, outcome: 'mocked' });
          return { proceed: false, output: mock.config.output, spanMetadata: { outcome: 'mocked' } };
        }
        // expect-only: fall through.
      }

      // Mock-only runs: unmocked tools execute live — the experiment never
      // configured a replay source, so there is nothing to miss against.
      if (!state.replayActive) {
        state.calls.push({ order: state.calls.length, toolName, outcome: 'live' });
        return;
      }

      const queue = state.queues.get(key);
      let event: ToolReplayEvent | undefined;
      if (state.matching === 'strict') {
        // Serve only an exact-args recorded call (canonicalized comparison).
        // Anything else is a miss — argMismatches stays empty by construction.
        const normalizedInput = normalizeArgsForComparison(input);
        const index = queue?.findIndex(e => deepEqual(normalizedInput, normalizeArgsForComparison(e.input))) ?? -1;
        if (index >= 0) event = queue!.splice(index, 1)[0];
      } else {
        event = queue?.shift();
      }

      if (!event) {
        state.misses.push({ toolName, action: options.onMiss, input: capMissInput(input) });
        state.calls.push({
          order: state.calls.length,
          toolName,
          outcome: options.onMiss === 'passthrough' ? 'miss-passthrough' : 'miss-error',
        });
        if (options.onMiss === 'passthrough') {
          return; // proceed with live execution
        }
        // "aborted" in the message also suppresses the experiment retry loop —
        // a replay miss is deterministic, retrying cannot fix it.
        const error = new Error(
          `Tool replay miss for '${toolName}': no recorded call ${
            state.matching === 'strict' ? 'with matching args ' : ''
          }remaining — execution aborted (onMiss: 'error')`,
        );
        options.onFatalMiss?.(error);
        throw error;
      }

      state.replayedCount++;
      const argsDiffered =
        state.matching !== 'strict' &&
        !deepEqual(normalizeArgsForComparison(input), normalizeArgsForComparison(event.input));
      if (argsDiffered) {
        state.argMismatches.push({ toolName, sequence: event.sequence, spanId: event.spanId });
      }
      state.calls.push({
        order: state.calls.length,
        toolName,
        outcome: event.error ? 'replayed-error' : 'replayed',
        sequence: event.sequence,
        ...(argsDiffered ? { argsDiffered: true } : {}),
      });

      if (event.error) {
        const error = new Error(event.error.message);
        // Never reuse names the tool-call step re-throws (instead of converting
        // to a tool-error result) — shared source of truth with the loop.
        if (event.error.name && !RETHROWN_TOOL_ERROR_NAMES.has(event.error.name)) {
          error.name = event.error.name;
        }
        throw error;
      }

      return {
        proceed: false,
        output: event.output,
        spanMetadata: { outcome: 'replayed', sequence: event.sequence },
      };
    },
  };
}

function mockKind(config: ToolMockConfig): ToolMockUsage['kind'] {
  if (typeof config === 'function') return 'function';
  if (config.cases) return 'cases';
  if (config.error) return 'error';
  if ('output' in config) return 'output';
  return 'observe';
}

/** Snapshot the divergence report, including events that were never consumed. */
export function finalizeReplayReport(state: ToolReplayState): ToolReplayReport {
  const unconsumed: { toolName: string; count: number }[] = [];
  for (const [toolName, queue] of state.queues) {
    if (queue.length > 0) {
      unconsumed.push({ toolName, count: queue.length });
    }
  }

  const mocks: ToolMockUsage[] = [];
  const expectations: ToolMockExpectationResult[] = [];
  for (const { toolName, config, calls } of state.mocks.values()) {
    mocks.push({ toolName, calls: calls.length, kind: mockKind(config) });

    const expect = typeof config === 'function' ? undefined : config.expect;
    if (!expect) continue;
    // When expected args are set, only calls with those args count.
    const counted =
      expect.args !== undefined
        ? calls.filter(call =>
            deepEqual(normalizeArgsForComparison(call.input), normalizeArgsForComparison(expect.args)),
          )
        : calls;
    const calledTimes = counted.length;
    const satisfied = expect.calledTimes != null ? calledTimes === expect.calledTimes : calledTimes >= 1;
    expectations.push({
      toolName,
      satisfied,
      calledTimes,
      ...(satisfied
        ? {}
        : {
            reason:
              expect.calledTimes != null
                ? `expected ${expect.calledTimes} call(s)${expect.args !== undefined ? ' with matching args' : ''}, got ${calledTimes}`
                : `expected at least one call${expect.args !== undefined ? ' with matching args' : ''}, got ${calledTimes}`,
          }),
    });
  }

  return {
    sourceTraceId: state.sourceTraceId,
    totalRecorded: state.totalRecorded,
    replayedCount: state.replayedCount,
    misses: [...state.misses],
    unconsumed,
    argMismatches: [...state.argMismatches],
    ...(state.redactedPayloadCount > 0 ? { redactedPayloadCount: state.redactedPayloadCount } : {}),
    ...(state.calls.length > 0 ? { calls: [...state.calls] } : {}),
    ...(mocks.length > 0 ? { mocks } : {}),
    ...(expectations.length > 0 ? { expectations } : {}),
  };
}
