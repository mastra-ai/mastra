import type { Cause, Engine, LayoutName, ReaderName } from './types';

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
};

const PLAIN = ['plain'] as const;
const DURABLE = ['durable', 'evented'] as const;
const SINGLE: readonly LayoutName[] = ['single/memory', 'single/redis', 'single/valkey'];
const SPLIT: readonly LayoutName[] = ['split/redis', 'split/valkey'];
const OVER_BUS: readonly LayoutName[] = ['single/redis', 'single/valkey', 'split/redis', 'split/valkey'];

const MAIN = 'main ef2c03fc121';

// Durable's own stream code: expected to disappear once durable runs on plain's stream layer.
const REBUILT_OBJECT: Attribution = {
  ticket: 'COR-1390',
  cause: 'durable-stream',
  evidence:
    'Durable never publishes object/object-result or the structured-output validation error: its read-back ' +
    'MastraModelOutput rebuilds them from the text after step-finish (agent/durable/stream-adapter.ts:878, :1209; ' +
    `stream/base/output.ts:1062). Harness topic capture has none of them (${MAIN}).`,
};
const NOT_ON_TOPIC: Attribution = {
  ticket: 'COR-1390',
  cause: 'durable-stream',
  evidence:
    'The raw topic carries only what durable published: no object/object-result/validation error (rebuilt ' +
    'reader-side, agent/durable/stream-adapter.ts:878) plus an iteration-complete event per step ' +
    `(agent/durable/workflows/durable-loop-builder.ts:984) that observe() strips (${MAIN}).`,
};
const NO_REBUILD: Attribution = {
  ticket: 'COR-1390',
  cause: 'durable-stream',
  evidence:
    'Readers without the run schema get only what durable published: the /observe route forwards the raw topic ' +
    '(packages/server/src/server/handlers/agents.ts:3155), and observe() in another process after the run recovers ' +
    'the schema only from the workflow snapshot (agent/durable/durable-agent.ts:5789-5807), which is gone by then. ' +
    `Harness split observe-0 vs observe-mid (${MAIN}).`,
};
const ITERATION: Attribution = {
  ticket: 'COR-1390',
  cause: 'durable-stream',
  evidence:
    'The durable loop publishes iteration-complete on the run topic after every step ' +
    `(agent/durable/workflows/durable-loop-builder.ts:984); plain never does and observe() strips it (${MAIN}).`,
};

// Execution engine: the chunks themselves differ.
const DURABLE_TOOL_ERROR: Attribution = {
  ticket: 'COR-1544',
  cause: 'engine',
  evidence:
    'The durable tool step replaces the thrown Error with serializeError() output ' +
    '(agent/durable/workflows/steps/tool-call.ts:2577), so every durable reader gets {message,name,stack}, plus ' +
    '__mastraSpanErrorOrigin on the in-memory backend only (harness memory vs Redis/Valkey capture, ' +
    `${MAIN}).`,
};
const DURABLE_START: Attribution = {
  ticket: 'COR-1544',
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
  ticket: 'COR-1519',
  cause: 'plain-layer',
  evidence:
    "Plain's input tripwire returns from map-results before the stream step runs " +
    '(agent/workflows/prepare-stream/map-results-step.ts:147), so the run publisher is never written to or closed ' +
    '(agent/agent.ts:9492 only fails it on a failed run): the topic stays empty and observers wait until they time ' +
    `out. Untracked bug; COR-1519 holds it until it has its own ticket (${MAIN}).`,
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
export const OBSERVATIONS: readonly Observation[] = [
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
