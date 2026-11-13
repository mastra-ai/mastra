import { ENGINES } from './types';
import type { Cause, Engine, LayoutName, ReaderName } from './types';

/**
 * Ticket placeholder for a difference whose ticket hasn't been filed yet.
 * Every use is listed in `UNFILED_DIFFERENCES` so it can't go unnoticed.
 */
export const UNFILED = 'UNFILED';

/** Why a reader differs: the Linear ticket, the cause and the evidence for that cause. */
export interface Attribution {
  /** Linear ticket, e.g. `COR-1390`. */
  ticket: string;
  cause: Cause;
  /** file:line or harness probe that shows the cause. */
  evidence: string;
}

/**
 * What a set of readers delivers in a set of cells when it differs from the
 * scenario's baseline (plain's live stream). Frames use the compact form
 * `type[shape]`; a frame without `[shape]` inherits the baseline's shape for
 * that type at that position (see `parseFrames`).
 */
export interface Observation extends Attribution {
  scenario: string;
  engines: readonly Engine[];
  /** Omit for every layout. */
  layouts?: readonly LayoutName[];
  readers: readonly ReaderName[];
  frames: string;
  /** Attribution for this reader's difference from its own run's live stream, when not the observation's own. */
  againstLive?: Attribution;
  /** Attribution for this reader's difference from plain's same reader, when not the observation's own. */
  againstPlain?: Attribution;
}

const APPROVAL_HEAD =
  'start,step-start,tool-call-input-streaming-start,' +
  'tool-call-delta,tool-call-delta,tool-call-delta,tool-call-delta,tool-call-delta,' +
  'tool-call-input-streaming-end,tool-call,tool-call-approval';
const APPROVAL_TAIL =
  'tool-call-resumed,tool-result[{"value":"found:harness"}],step-finish,' +
  'step-start,text-start,text-delta[The lookup found it.],text-end,step-finish,finish';
const APPROVAL_FULL = `${APPROVAL_HEAD},${APPROVAL_TAIL}`;

/** Plain's live stream for each scenario: the reference every reader of every engine is held to. */
export const BASELINES: Record<string, string> = {
  'structured-output':
    'start,step-start,text-start,text-delta[{"answer":"forty-two"}],object[{"answer":"forty-two"}],text-end,' +
    'object-result[{"answer":"forty-two"}],step-finish,finish',
  'structured-invalid':
    'start,step-start,text-start,text-delta[{"answer":42}],object[{"answer":42}],text-end,' +
    'error[isError=true keys=category|cause|details|domain|id|message type=object],step-finish,finish',
  'tool-throws':
    'start,step-start,tool-call-input-streaming-start,tool-call-delta,tool-call-input-streaming-end,tool-call,' +
    'tool-error[isError=true keys=category|cause|details|domain|id|name type=object],step-finish,' +
    'step-start,text-start,text-delta[The tool failed.],text-end,step-finish,finish',
  'tool-undefined':
    'start,step-start,tool-call-input-streaming-start,tool-call-delta,tool-call-input-streaming-end,tool-call,' +
    'tool-result[null],step-finish,step-start,text-start,text-delta[The tool returned nothing.],text-end,step-finish,finish',
  'input-tripwire': 'tripwire[blocked by harness]',
  'tool-approval': APPROVAL_HEAD,
  'run-id-reuse': 'start,step-start,text-start,text-delta[Second answer.],text-end,step-finish,finish',
  // Abort timing determines the text boundary; compare frame types, not partial text.
  'observer-cleanup': 'start,step-start,text-start,text-delta[Watched.],text-end,step-finish,finish',
  abort: 'start,step-start,text-start,text-delta,abort,finish',
  'direct-abort': 'start,step-start,text-start,text-delta,abort,finish',
  'key-cleanup': 'start,step-start,text-start,text-delta[Done.],text-end,step-finish,finish',
};

/** Plain's value of each fact a scenario records (single frames, compared with plain only). */
export const FACT_BASELINES: Record<string, Partial<Record<ReaderName, string>>> = {
  abort: { ack: 'ack[status=200 aborted=true]' },
  'direct-abort': { 'abort-result': 'abort-result[returned=true unknown=false]' },
  'generate-abort': { ack: 'ack[status=200 aborted=true]', generate: 'generate[finish=aborted text=empty]' },
  'generate-partial-abort': {
    ack: 'ack[status=200 aborted=true]',
    generate: 'generate[finish=aborted text=empty callback=empty calls=1 matches=true]',
  },
  'resume-generate-abort': {
    ack: 'ack[status=200 aborted=true]',
    generate: 'generate[finish=aborted text=empty callback=empty calls=1 matches=true]',
  },
  'key-cleanup': { keys: '(memory)' },
};

const PLAIN = ['plain'] as const;
const DURABLE = ['durable', 'evented'] as const;
const SINGLE: readonly LayoutName[] = ['single/memory', 'single/redis', 'single/valkey'];
const SPLIT: readonly LayoutName[] = ['split/redis', 'split/valkey'];
const OVER_BUS: readonly LayoutName[] = ['single/redis', 'single/valkey', 'split/redis', 'split/valkey'];

const MAIN = 'main ef2c03fc121';

// Engine output: consolidation alone cannot publish chunks the engine never emits.
const REBUILT_OBJECT: Attribution = {
  ticket: 'COR-1547',
  cause: 'engine',
  evidence:
    'Durable never publishes object/object-result or the structured-output validation error: its read-back ' +
    'MastraModelOutput rebuilds them from the text after step-finish (agent/durable/stream-adapter.ts:878, :1209; ' +
    `stream/base/output.ts:1062). Harness topic capture has none of them (${MAIN}).`,
};
const NOT_ON_TOPIC: Attribution = {
  ticket: 'COR-1547',
  cause: 'engine',
  evidence:
    'The raw topic carries only what durable published: no object/object-result/validation error (rebuilt ' +
    'reader-side, agent/durable/stream-adapter.ts:878) plus an iteration-complete event per step ' +
    `(agent/durable/workflows/durable-loop-builder.ts:984) that observe() strips (${MAIN}).`,
};
const NO_REBUILD: Attribution = {
  ticket: 'COR-1547',
  cause: 'engine',
  evidence:
    'Readers without the run schema get only what durable published: the /observe route forwards the raw topic ' +
    '(packages/server/src/server/handlers/agents.ts:3155), and observe() in another process after the run recovers ' +
    'the schema only from the workflow snapshot (agent/durable/durable-agent.ts:5789-5807), which is gone by then. ' +
    `Harness split observe-0 vs observe-mid (${MAIN}).`,
};
const ITERATION: Attribution = {
  ticket: 'COR-1557',
  cause: 'durable-stream',
  evidence:
    'The durable loop publishes iteration-complete on the run topic after every step ' +
    `(agent/durable/workflows/durable-loop-builder.ts:984); plain never does and observe() strips it (${MAIN}).`,
};

// Execution engine: the chunks themselves differ.
const DURABLE_TOOL_ERROR: Attribution = {
  ticket: 'COR-1548',
  cause: 'engine',
  evidence:
    'The durable tool step replaces the thrown Error with serializeError() output ' +
    '(agent/durable/workflows/steps/tool-call.ts:2577), so every durable reader gets {message,name,stack}, plus ' +
    '__mastraSpanErrorOrigin on the in-memory backend only (harness memory vs Redis/Valkey capture, ' +
    `${MAIN}).`,
};
const DURABLE_START: Attribution = {
  ticket: 'COR-1548',
  cause: 'engine',
  evidence:
    "Durable emits a start chunk before input processors run (agent/durable/durable-agent.ts:3454); plain's " +
    `input tripwire returns before any chunk (agent/workflows/prepare-stream/map-results-step.ts:147) (${MAIN}).`,
};

// Plain's stream layer: survives consolidation.
const PLAIN_ERROR_PUBLISH: Attribution = {
  ticket: 'COR-1544',
  cause: 'plain-layer',
  evidence:
    'Plain publishes error chunks through serializeIfError (agent/streams/publisher.ts:309, :341), so every reader ' +
    'that crossed the bus gets a plain {name,message,stack,...} object while the caller keeps the Error; the server ' +
    `route then drops stack (packages/server/src/server/server-adapter/serialize.ts:45) (${MAIN}).`,
};
const PLAIN_TOOL_ERROR_JSON: Attribution = {
  ticket: 'COR-1544',
  cause: 'plain-layer',
  evidence:
    'Plain serialises only error chunks (agent/streams/publisher.ts:309); a tool-error chunk goes over Redis/Valkey ' +
    "as JSON, which drops the Error's non-enumerable message and stack (harness: in-memory readers keep the " +
    `Error, Redis/Valkey readers do not; ${MAIN}).`,
};
const SERVER_ROUTE_ERROR: Attribution = {
  ticket: 'COR-1544',
  cause: 'plain-layer',
  evidence:
    'The server route rewrites payload errors for SSE: Error -> plain object with message, without stack ' +
    `(packages/server/src/server/server-adapter/serialize.ts:32-45) (${MAIN}).`,
};
const THREAD_ENDS_AT_TERMINAL: Attribution = {
  ticket: 'COR-1546',
  cause: 'plain-layer',
  evidence:
    'The thread stream ends at the first terminal chunk (error/abort/tripwire) for every engine ' +
    '(agent/thread-stream-runtime.ts:7524), so a thread subscriber never sees the step-finish/finish after an ' +
    'error; across processes the thread topic carries MastraError.toJSON() output (code instead of id/name) ' +
    `(${MAIN}).`,
};
const PLAIN_TRIPWIRE_UNPUBLISHED: Attribution = {
  ticket: UNFILED,
  cause: 'plain-layer',
  evidence:
    "Plain's input tripwire returns from map-results before the stream step runs " +
    '(agent/workflows/prepare-stream/map-results-step.ts:147), so the run publisher is never written to or closed ' +
    '(agent/agent.ts:9492 only fails it on a failed run): the topic stays empty and observers wait until they time ' +
    `out. No ticket covers this (closest, PLTFRM-3226 "Tripwire stream omits finish chunk", is an unverified ` +
    `finding about trip-wire.ts and doesn't describe the unpublished/unclosed run); new ticket awaiting approval ` +
    `(${MAIN}).`,
};
/** Differences listed with `UNFILED` and the ticket they're waiting for. */
export const UNFILED_DIFFERENCES = {
  'plain input tripwire never published or closed': PLAIN_TRIPWIRE_UNPUBLISHED,
};
const ROUTE_CLOSES_ON_FINISH: Attribution = {
  ticket: 'COR-1543',
  cause: 'plain-layer',
  evidence:
    'The /observe route closes only on finish/error/abort (packages/server/src/server/handlers/agents.ts:3263), ' +
    'so it forwards the finish durable publishes after a tripwire, while observe() and the caller stop at the ' +
    `tripwire (${MAIN}).`,
};

const obs = (
  scenario: string,
  engines: readonly Engine[],
  readers: readonly ReaderName[],
  frames: string,
  attribution: Attribution,
  extra: Partial<Pick<Observation, 'layouts' | 'againstLive' | 'againstPlain'>> = {},
): Observation => ({ scenario, engines, readers, frames, ...attribution, ...extra });

const STRUCTURED_DURABLE = 'start,step-start,text-start,text-delta,object,text-end,step-finish,object-result,finish';
const STRUCTURED_PUBLISHED = 'start,step-start,text-start,text-delta,text-end,step-finish,finish';
const STRUCTURED_TOPIC = 'start,step-start,text-start,text-delta,text-end,step-finish,iteration-complete,finish';
const INVALID_DURABLE = 'start,step-start,text-start,text-delta,object,text-end,step-finish,error,finish';
const TOOL_CALL =
  'start,step-start,tool-call-input-streaming-start,tool-call-delta,tool-call-input-streaming-end,tool-call';
const toolThrows = (error: string, iterations = false) => {
  const end = iterations ? 'step-finish,iteration-complete' : 'step-finish';
  return `${TOOL_CALL},tool-error[${error}],${end},step-start,text-start,text-delta,text-end,${end},finish`;
};

/**
 * Every way a reader is allowed to differ from the baseline. The grid derives
 * the exact differences each cell must show from these (`knownDifferencesFor`)
 * and fails on any it does not see (stale) or sees but cannot derive
 * (unlisted).
 */
const SUSPENSION_BOUNDARY: Attribution = {
  ticket: 'COR-1559',
  cause: 'durable-stream',
  evidence:
    'The original durable stream stays open across suspension (agent/durable/stream-adapter.ts:934), ' +
    'whereas the plain caller ends its segment; observers follow the complete run. The separate resume reader ' +
    `starts at tool-call-resumed. Harness approval captures (${MAIN}); this is a contract difference, not duplicated execution.`,
};
const THREAD_RESUME_START: Attribution = {
  ticket: 'COR-1546',
  cause: 'plain-layer',
  evidence:
    'Plain thread broadcasting injects a start before the resumed segment because that segment has none ' +
    `(agent/thread-stream-runtime.ts:3767-3781). The caller and run observers do not receive it (${MAIN}).`,
};
const REUSED_RUN: Attribution = {
  ticket: 'COR-1542',
  cause: 'durable-stream',
  evidence:
    'Plain clears finished run history before claiming a reused ID (agent/agent.ts:9411-9419); durable observe ' +
    `resolves its previous registry entry (agent/durable/durable-agent.ts:5763), replaying First answer. (${MAIN}).`,
};
const OBSERVER_DELETES_HISTORY: Attribution = {
  ticket: 'COR-1541',
  cause: 'durable-stream',
  evidence:
    'A remote durable observer arms its own 1s cleanup after finish and clears the shared topic ' +
    '(agent/durable/durable-agent.ts:5741-5761), before the publisher default cleanup. ' +
    `Split replay 2.5s later times out with an empty topic; plain retains both (${MAIN}).`,
};
const EXPIRED_HISTORY: Attribution = {
  ticket: 'COR-1543',
  cause: 'plain-layer',
  evidence:
    'Publisher cleanup deletes the run topic (agent/streams/publisher.ts:216); after the single-process ' +
    `1s cleanup, plain observe waits until timeout and durable returns empty. No explicit history-expired result (${MAIN}).`,
};
const ABORT_TOPIC: Attribution = {
  ticket: 'COR-1544',
  cause: 'plain-layer',
  evidence:
    'The publisher deliberately omits abort chunks because observers rebuild them from finishReason ' +
    `(agent/streams/publisher.ts:76, :255). All engines have finish on the raw topic but abort,finish on readers (${MAIN}).`,
};
const REMAINING_KEYS: Attribution = {
  ticket: 'COR-1534',
  cause: 'plain-layer',
  evidence:
    'Run cleanup deletes run/control/ack topics, not the thread-stream topic (agent/streams/publisher.ts:216). ' +
    'The dedicated fixture prefix also exposes scheduler/workflow infrastructure keys; these are reported, not ' +
    `claimed as leaked run logs. TTLs bucketed 4s after finish (${MAIN}; stream-harness-node.entry.ts:332).`,
};
const DURABLE_REMAINING_KEYS: Attribution = {
  ticket: 'COR-1540',
  cause: 'durable-stream',
  evidence:
    'Durable cleanup clears its run topic (agent/durable/durable-agent.ts:6123), leaving agent.control.<run> ' +
    `with hours TTL after the 2s cleanup window; plain removes it (${MAIN}; stream-harness-node.entry.ts:332).`,
};
const EVENTED_INFRA_KEYS: Attribution = {
  ticket: 'COR-1534',
  cause: 'engine',
  evidence:
    'Evented execution additionally leaves workflow control/finish and short-lived workflow-step lease keys ' +
    `(stream-harness-node.entry.ts:332). These are engine infrastructure, not extra agent stream histories (${MAIN}).`,
};
const BUS_KEYS =
  'key[:agent.thread-stream.harness-user%00<thread> ttl=hours],key[:scheduler ttl=hours],key[:workflows ttl=hours]';
const DURABLE_KEYS = 'key[:agent.control.<run> ttl=hours],' + BUS_KEYS;
const EVENTED_KEYS =
  'key[:agent.control.<run> ttl=hours],key[:agent.thread-stream.harness-user%00<thread> ttl=hours],' +
  'key[:lease:workflow-step-run:<id>:<id> ttl=seconds],key[:lease:workflow-step-run:<run>:<id> ttl=seconds],' +
  'key[:scheduler ttl=hours],key[:workflow.control ttl=hours],key[:workflows ttl=hours],key[:workflows-finish ttl=hours]';

export const OBSERVATIONS: readonly Observation[] = [
  obs(
    'generate-partial-abort',
    DURABLE,
    ['generate'],
    'generate[finish=aborted text=cut callback=cut calls=1 matches=true]',
    {
      ticket: 'COR-1405',
      cause: 'engine',
      evidence:
        `${MAIN}, agent/durable/durable-agent.ts:4837-4848: durable generate collects a streaming result, ` +
        'so abort after its first text callback retains a partial prefix. Plain generate uses a non-streaming provider request and exposes no prefix before abort.',
    },
  ),
  obs(
    'resume-generate-abort',
    DURABLE,
    ['generate'],
    'generate[finish=aborted text=empty callback=cut calls=1 matches=false]',
    {
      ticket: 'COR-1405',
      cause: 'engine',
      evidence:
        `${MAIN}, agent/durable/durable-agent.ts:5129-5152: resumeGenerate drains resume().output.getFullOutput(). ` +
        'Aborting after the first text callback returns empty output text despite a nonempty onAbort text prefix.',
    },
  ),
  // Lifecycle: original and resume streams are separate captures, never concatenated.
  obs('tool-approval', ['plain', ...DURABLE], ['live-resume'], APPROVAL_TAIL, SUSPENSION_BOUNDARY),
  obs('tool-approval', PLAIN, ['observe-mid', 'observe-0', 'http-observe'], APPROVAL_FULL, SUSPENSION_BOUNDARY),
  obs('tool-approval', PLAIN, ['topic'], `${APPROVAL_HEAD},suspended,${APPROVAL_TAIL}`, SUSPENSION_BOUNDARY),
  obs('tool-approval', PLAIN, ['thread'], `${APPROVAL_HEAD},start,${APPROVAL_TAIL}`, THREAD_RESUME_START),
  obs(
    'tool-approval',
    DURABLE,
    ['live', 'observe-mid', 'observe-0', 'http-observe', 'thread'],
    APPROVAL_FULL,
    SUSPENSION_BOUNDARY,
  ),
  obs(
    'tool-approval',
    DURABLE,
    ['topic'],
    `${APPROVAL_HEAD},suspended,${APPROVAL_TAIL.replaceAll('step-finish', 'step-finish,iteration-complete')}`,
    ITERATION,
    { againstPlain: ITERATION },
  ),

  obs(
    'run-id-reuse',
    DURABLE,
    ['observe-mid', 'observe-0', 'http-observe'],
    'start,step-start,text-start,text-delta[First answer.],text-end,step-finish,finish',
    REUSED_RUN,
  ),
  obs(
    'run-id-reuse',
    DURABLE,
    ['topic'],
    'start,step-start,text-start,text-delta[First answer.],text-end,step-finish,iteration-complete,finish,' +
      'start,step-start,text-start,text-delta[Second answer.],text-end,step-finish,iteration-complete,finish',
    REUSED_RUN,
  ),

  obs('observer-cleanup', PLAIN, ['observe-0'], '(timeout)', EXPIRED_HISTORY, { layouts: SINGLE }),
  obs('observer-cleanup', PLAIN, ['topic'], '', EXPIRED_HISTORY, { layouts: SINGLE }),
  obs('observer-cleanup', DURABLE, ['observe-0', 'topic'], '', EXPIRED_HISTORY, { layouts: SINGLE }),
  obs('observer-cleanup', DURABLE, ['observe-0'], '(timeout)', OBSERVER_DELETES_HISTORY, { layouts: SPLIT }),
  obs('observer-cleanup', DURABLE, ['topic'], '', OBSERVER_DELETES_HISTORY, { layouts: SPLIT }),

  ...['abort', 'direct-abort'].flatMap(scenario => [
    obs(scenario, ENGINES, ['topic'], 'start,step-start,text-start,text-delta,finish', ABORT_TOPIC),
    obs(scenario, ENGINES, ['thread'], 'start,step-start,text-start,text-delta,abort', THREAD_ENDS_AT_TERMINAL),
  ]),
  obs(
    'direct-abort',
    ENGINES,
    ['abort-result'],
    'abort-result[returned=false unknown=false]',
    {
      ticket: 'COR-1330',
      cause: 'plain-layer',
      evidence:
        'agent/agent.ts:10569-10576 sends the remote abort request but returns false; durable delegates to it ' +
        'and checks only local execution (agent/durable/durable-agent.ts:2922-2932). The split fixture calls ' +
        'abortRunStream directly: every engine returns false while live and observe readers receive abort,finish. ' +
        'The same-process control returns true and an unknown run returns false.',
    },
    { layouts: SPLIT },
  ),
  obs('key-cleanup', PLAIN, ['keys'], BUS_KEYS, REMAINING_KEYS, { layouts: OVER_BUS }),
  obs('key-cleanup', ['durable'], ['keys'], DURABLE_KEYS, DURABLE_REMAINING_KEYS, { layouts: OVER_BUS }),
  obs('key-cleanup', ['evented'], ['keys'], EVENTED_KEYS, EVENTED_INFRA_KEYS, { layouts: OVER_BUS }),
  // structured-output
  obs('structured-output', DURABLE, ['live', 'observe-mid', 'thread'], STRUCTURED_DURABLE, REBUILT_OBJECT),
  obs('structured-output', DURABLE, ['observe-0'], STRUCTURED_DURABLE, REBUILT_OBJECT, { layouts: SINGLE }),
  obs('structured-output', DURABLE, ['topic'], STRUCTURED_TOPIC, NOT_ON_TOPIC),
  obs('structured-output', DURABLE, ['http-observe'], STRUCTURED_PUBLISHED, NO_REBUILD),
  obs('structured-output', DURABLE, ['observe-0'], STRUCTURED_PUBLISHED, NO_REBUILD, { layouts: SPLIT }),

  // structured-invalid
  obs(
    'structured-invalid',
    PLAIN,
    ['observe-mid', 'topic', 'observe-0'],
    'start,step-start,text-start,text-delta,object,text-end,' +
      'error[isError=false keys=category|details|domain|id|message|name|stack type=object],step-finish,finish',
    PLAIN_ERROR_PUBLISH,
  ),
  obs(
    'structured-invalid',
    PLAIN,
    ['http-observe'],
    'start,step-start,text-start,text-delta,object,text-end,' +
      'error[isError=false keys=category|details|domain|id|message|name type=object],step-finish,finish',
    PLAIN_ERROR_PUBLISH,
  ),
  obs(
    'structured-invalid',
    PLAIN,
    ['thread'],
    'start,step-start,text-start,text-delta,object,text-end,error',
    THREAD_ENDS_AT_TERMINAL,
    {
      layouts: SINGLE,
    },
  ),
  obs(
    'structured-invalid',
    PLAIN,
    ['thread'],
    'start,step-start,text-start,text-delta,object,text-end,' +
      'error[isError=false keys=category|code|details|domain|message type=object]',
    THREAD_ENDS_AT_TERMINAL,
    { layouts: SPLIT },
  ),
  obs('structured-invalid', DURABLE, ['live', 'observe-mid'], INVALID_DURABLE, REBUILT_OBJECT),
  obs('structured-invalid', DURABLE, ['observe-0'], INVALID_DURABLE, REBUILT_OBJECT, { layouts: SINGLE }),
  obs('structured-invalid', DURABLE, ['topic'], STRUCTURED_TOPIC, NOT_ON_TOPIC),
  obs('structured-invalid', DURABLE, ['http-observe'], STRUCTURED_PUBLISHED, NO_REBUILD),
  obs('structured-invalid', DURABLE, ['observe-0'], STRUCTURED_PUBLISHED, NO_REBUILD, { layouts: SPLIT }),
  obs(
    'structured-invalid',
    DURABLE,
    ['thread'],
    'start,step-start,text-start,text-delta,object,text-end,step-finish,error',
    REBUILT_OBJECT,
    { layouts: SINGLE, againstLive: THREAD_ENDS_AT_TERMINAL },
  ),
  obs(
    'structured-invalid',
    DURABLE,
    ['thread'],
    'start,step-start,text-start,text-delta,object,text-end,step-finish,' +
      'error[isError=false keys=category|code|details|domain|message type=object]',
    REBUILT_OBJECT,
    { layouts: SPLIT, againstLive: THREAD_ENDS_AT_TERMINAL },
  ),

  // tool-throws
  obs(
    'tool-throws',
    PLAIN,
    ['http-observe'],
    toolThrows('isError=false keys=category|cause|details|domain|id|message|name type=object'),
    SERVER_ROUTE_ERROR,
    { layouts: ['single/memory'] },
  ),
  obs(
    'tool-throws',
    PLAIN,
    ['observe-mid', 'topic', 'observe-0', 'http-observe'],
    toolThrows('isError=false keys=category|cause|details|domain|id|name type=object'),
    PLAIN_TOOL_ERROR_JSON,
    { layouts: OVER_BUS },
  ),
  obs(
    'tool-throws',
    PLAIN,
    ['thread'],
    toolThrows('isError=false keys=category|cause|details|domain|id|name type=object'),
    PLAIN_TOOL_ERROR_JSON,
    { layouts: SPLIT },
  ),
  obs(
    'tool-throws',
    DURABLE,
    ['live', 'observe-mid', 'observe-0', 'thread'],
    toolThrows('isError=false keys=__mastraSpanErrorOrigin|message|name|stack type=object'),
    DURABLE_TOOL_ERROR,
    { layouts: ['single/memory'] },
  ),
  obs(
    'tool-throws',
    DURABLE,
    ['topic'],
    toolThrows('isError=false keys=__mastraSpanErrorOrigin|message|name|stack type=object', true),
    ITERATION,
    { layouts: ['single/memory'] },
  ),
  obs(
    'tool-throws',
    DURABLE,
    ['live', 'observe-mid', 'observe-0', 'thread'],
    toolThrows('isError=false keys=message|name|stack type=object'),
    DURABLE_TOOL_ERROR,
    { layouts: OVER_BUS },
  ),
  obs(
    'tool-throws',
    DURABLE,
    ['topic'],
    toolThrows('isError=false keys=message|name|stack type=object', true),
    ITERATION,
    {
      layouts: OVER_BUS,
    },
  ),
  obs(
    'tool-throws',
    DURABLE,
    ['http-observe'],
    toolThrows('isError=false keys=message|name type=object'),
    DURABLE_TOOL_ERROR,
    {
      againstLive: SERVER_ROUTE_ERROR,
    },
  ),

  // tool-undefined: every reader agrees except durable's raw topic.
  obs(
    'tool-undefined',
    DURABLE,
    ['topic'],
    `${TOOL_CALL},tool-result,step-finish,iteration-complete,step-start,text-start,text-delta,text-end,step-finish,iteration-complete,finish`,
    ITERATION,
  ),

  // input-tripwire
  obs('input-tripwire', PLAIN, ['observe-mid', 'observe-0', 'http-observe'], '(timeout)', PLAIN_TRIPWIRE_UNPUBLISHED),
  obs('input-tripwire', PLAIN, ['topic'], '', PLAIN_TRIPWIRE_UNPUBLISHED),
  obs('input-tripwire', DURABLE, ['live', 'thread'], 'start,tripwire', DURABLE_START),
  obs('input-tripwire', DURABLE, ['observe-mid', 'observe-0'], 'start,tripwire', DURABLE_START, {
    againstPlain: PLAIN_TRIPWIRE_UNPUBLISHED,
  }),
  obs('input-tripwire', DURABLE, ['topic'], 'start,tripwire,iteration-complete,finish', ITERATION, {
    againstPlain: PLAIN_TRIPWIRE_UNPUBLISHED,
  }),
  obs('input-tripwire', DURABLE, ['http-observe'], 'start,tripwire,finish', ROUTE_CLOSES_ON_FINISH, {
    againstPlain: PLAIN_TRIPWIRE_UNPUBLISHED,
  }),
];
