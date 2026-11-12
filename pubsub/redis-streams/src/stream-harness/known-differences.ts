import type { KnownDifference } from './types';

const PLAIN_STRUCTURED = 'start,step-start,text-start,object,text-delta,text-end,object-result,step-finish,finish';
const DURABLE_STRUCTURED = 'start,step-start,text-start,object,text-delta,text-end,step-finish,object-result,finish';
const DURABLE_STRUCTURED_TOPIC =
  'start,step-start,text-start,text-delta,text-end,step-finish,iteration-complete,finish';

/**
 * Durable never publishes `object` / `object-result`: the reader-side
 * `MastraModelOutput` built by durable's read-back rebuilds them from the
 * text (`agent/durable/stream-adapter.ts:1209` passes `structuredOutput`,
 * `stream/base/output.ts:1062` pipes it through `createObjectStreamTransformer`),
 * so they land after `step-finish`. The durable loop also publishes an
 * `iteration-complete` event plain never sends
 * (`agent/durable/workflows/durable-loop-builder.ts:984`).
 */
const STRUCTURED_EVIDENCE =
  'agent/durable/stream-adapter.ts:1209 + stream/base/output.ts:1062 rebuild object/object-result reader-side; ' +
  'durable-loop-builder.ts:984 publishes iteration-complete; harness topic capture shows neither object frame published (main ef2c03fc121)';

/**
 * Every difference the stream harness is allowed to observe. Each entry names
 * its Linear ticket, its cause and the evidence for that cause. The grid
 * fails on any observed difference not listed here, and on any entry that
 * applies to a cell but does not reproduce in it (see `judgeCell`).
 */
export const KNOWN_DIFFERENCES: readonly KnownDifference[] = (['durable', 'evented'] as const).flatMap(engine => [
  {
    scenario: 'structured-output',
    engine,
    reader: 'live',
    against: 'plain',
    kind: 'sequence',
    detail: `expected ${PLAIN_STRUCTURED} got ${DURABLE_STRUCTURED}`,
    ticket: 'COR-1390',
    cause: 'durable-stream',
    evidence: STRUCTURED_EVIDENCE,
  },
  {
    scenario: 'structured-output',
    engine,
    reader: 'topic',
    against: 'live',
    kind: 'sequence',
    detail: `expected ${DURABLE_STRUCTURED} got ${DURABLE_STRUCTURED_TOPIC}`,
    ticket: 'COR-1390',
    cause: 'durable-stream',
    evidence: STRUCTURED_EVIDENCE,
  },
]);
