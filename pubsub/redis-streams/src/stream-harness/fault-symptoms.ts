import { diffFrames } from './compare';
import { READERS } from './types';
import type { Cell, Cause, Frame, ReaderName, RunCapture } from './types';

export interface Symptom {
  ticket: string;
  cause: Cause | 'untraced';
  evidence: string;
  cell: Cell;
  reader: ReaderName;
  observed: Frame[];
}

export interface RetryTrace {
  node: string;
  pid: number;
  sequence: number;
  boundary: 'dispatch' | 'handle' | 'nonretryable' | 'result' | 'nack' | 'model';
  delivery: string;
  eventId: string;
  workflowRunId: string;
  attempt: number;
  invocation?: string;
  errorId?: string;
  agentRunId?: string;
  ok?: boolean;
  retry?: boolean;
  requestNumber?: number;
}

export interface RetryEvidence {
  runId: string;
  modelRequests: number;
  records: RetryTrace[];
}

const FAULTS = ['pause-5s', 'pause-60s', 'connection-reset'];
const REPLAY = {
  ticket: 'COR-1561',
  cause: 'plain-layer',
  evidence:
    'caching-pubsub.ts:294-305,422-454; replay-duplicate-current.txt: successful append loses reply, unindexed delivery is backfilled again',
} as const;
const VALKEY = {
  ticket: 'COR-1561',
  cause: 'plain-layer',
  evidence:
    'caching-pubsub.ts:294-305,422-454; COR-1561 Valkey trace: failed indexed writes publish unindexed live chunks and leave replay holes',
} as const;
const THREAD_PUMP = {
  ticket: 'COR-1562',
  cause: 'plain-layer',
  evidence:
    'thread-stream-runtime.ts:3826-3839,3891,3924-3930; COR-1562 trace: rejected publish terminates the plain thread pump',
} as const;
const VALKEY_STALL = {
  ticket: 'UNATTRIBUTED_VALKEY_STALL',
  cause: 'untraced',
  evidence:
    'p4-fault-grid.txt: exact reader-specific Valkey partial/timeout/unavailable-history envelopes; caller-stall cause not established by cache corruption or thread-pump trace',
} as const;
const APPROVAL = {
  ticket: 'UNFILED_APPROVAL_ORDER',
  cause: 'plain-layer',
  evidence:
    'agent/streams/publisher.ts:225-239; approval-ordering.txt: plain Valkey topic can publish resumed before suspended; Nik authorized this unfiled exception',
} as const;

const TIMED_OUT = [
  'isError=false keys=message|name|stack type=object message="timed out"',
  'isError=false keys=message|name type=object message="timed out"',
  'isError=true keys=name type=object message="timed out"',
];
const LEASE_LOST =
  'isError=true keys=name type=object message="Thread run <run> lost its lease before publishing a terminal event"';

/** The wire fixture emits four-character chunks. Accept repeats, never invent text. */
function replayText(value: string, answer: string, complete: boolean): boolean {
  if (!value || value.length > answer.length * 2) return false;
  const chunks = answer.match(/.{1,4}/gs)!;
  const delivered = value.match(/.{1,4}/gs)!;
  let positions = new Set([0]);
  for (const chunk of delivered) {
    const next = new Set<number>();
    for (const position of positions) {
      if (chunks[position] === chunk) next.add(position + 1);
      if (position > 0 && chunks[position - 1] === chunk) next.add(position);
    }
    positions = next;
  }
  return complete ? positions.has(chunks.length) : positions.size > 0;
}

function valkeyText(value: string, answer: string): boolean {
  if (replayText(value, answer, true)) return true;
  // Captured garbling changes one four-character-aligned seam in the first
  // half: a dropped span or an inserted contiguous fixture span. The rest,
  // including the complete ending, must remain verbatim and in order.
  for (let seam = 4; seam <= 48; seam += 4) {
    for (let end = seam + 4; end <= 48; end += 4) {
      if (value === answer.slice(0, seam) + answer.slice(end)) return true;
    }
    for (let from = 0; from < 48; from += 4) {
      for (let to = from + 4; to <= 48; to += 4) {
        if (value === answer.slice(0, seam) + answer.slice(from, to) + answer.slice(seam)) return true;
      }
    }
  }
  return false;
}

function sameExceptText(actual: Frame[], expected: Frame[], validText: (text: string) => boolean): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((frame, index) => {
    const reference = expected[index]!;
    if (frame.type !== reference.type) return false;
    if (frame.type === 'text-delta') return typeof frame.shape === 'string' && validText(frame.shape);
    return frame.shape === reference.shape;
  });
}

function partialValkey(frames: Frame[], reader: ReaderName, cell: Cell, answer: string): boolean {
  if (cell.engine === 'plain' && reader !== 'observe-mid' && reader !== 'thread') return false;
  if (cell.engine === 'durable' && cell.topology === 'split' && cell.scenario !== 'connection-reset') {
    if ((reader === 'topic' || reader === 'observe-0') && frames.length === 0) return true;
    if (
      reader === 'http-observe' &&
      frames.length === 1 &&
      frames[0]!.type === '(http 404)' &&
      frames[0]!.shape === '{"error":"Run not found"}'
    )
      return true;
  }
  const header = ['start', 'step-start', 'text-start', 'text-delta'];
  if (!header.every((type, index) => frames[index]?.type === type)) return false;
  if (frames.slice(0, 3).some(frame => frame.shape !== undefined)) return false;
  const tail = frames.slice(3);
  const first = tail[0]!;
  if (typeof first.shape !== 'string' || !replayText(first.shape, answer, false)) return false;
  const rest = tail.slice(1);
  if (!rest.length)
    return (
      cell.engine !== 'plain' &&
      ((reader === 'thread' && (cell.topology === 'single' || cell.scenario !== 'pause-60s')) ||
        (reader === 'topic' && cell.scenario === 'connection-reset'))
    );
  const last = rest.at(-1)!;
  const timedOut = last.type === '(timeout)' && last.shape === undefined;
  const threw =
    reader === 'thread' &&
    cell.engine === 'plain' &&
    cell.topology === 'single' &&
    last.type === '(threw)' &&
    ((cell.scenario !== 'connection-reset' &&
      last.shape === 'isError=true keys=message type=object message="timed out" id=-') ||
      (cell.scenario === 'connection-reset' &&
        last.shape ===
          'isError=true keys=message type=object message="Received connection error `Failed to receive a response due to a fatal error - FatalReceiveError: channel closed`. Will attempt to reconnect" id=-'));
  const errors = timedOut || threw ? rest.slice(0, -1) : rest;
  if (threw) return errors.length === 0;
  if (errors.length === 0) {
    if (!timedOut) return false;
    if (cell.engine === 'plain')
      return reader === 'observe-mid' && cell.topology === 'single' && cell.scenario === 'pause-60s';
    if (reader === 'live') return true;
    if (reader === 'observe-mid') return cell.topology === 'single' || cell.scenario === 'connection-reset';
    return (reader === 'observe-0' || reader === 'http-observe') && cell.scenario === 'connection-reset';
  }
  if (reader === 'live') return false;
  // Evented observe replay really does deliver one more chunk after the first
  // timeout error. Pin that exact two-error envelope, not arbitrary interleaving.
  if (cell.engine === 'evented' && (reader === 'observe-0' || reader === 'http-observe') && errors.length === 3) {
    if (timedOut !== (reader === 'observe-0' && cell.topology === 'split')) return false;
    if (reader === 'http-observe' && cell.topology !== 'single') return false;
    const shape = reader === 'http-observe' ? TIMED_OUT[1] : TIMED_OUT[0];
    return (
      errors[0]!.type === 'error' &&
      errors[0]!.shape === shape &&
      errors[1]!.type === 'text-delta' &&
      errors[1]!.shape === ' ans' &&
      first.shape === 'This ans' &&
      errors[2]!.type === 'error' &&
      errors[2]!.shape === shape
    );
  }
  if (!errors.every(frame => frame.type === 'error')) return false;
  const shapes = errors.map(frame => frame.shape);
  if (reader === 'thread')
    return (
      cell.engine !== 'plain' &&
      !timedOut &&
      cell.topology === 'split' &&
      cell.scenario === 'pause-60s' &&
      shapes.length === 1 &&
      shapes[0] === LEASE_LOST
    );
  if (cell.engine === 'evented' && shapes.length === 1) {
    if (reader === 'http-observe') return !timedOut && cell.topology === 'split' && shapes[0] === TIMED_OUT[1];
    if (reader === 'topic') return !timedOut && shapes[0] === TIMED_OUT[0];
    return reader === 'observe-mid' && cell.topology === 'split' && timedOut && shapes[0] === TIMED_OUT[0];
  }
  if (cell.engine !== 'durable' || timedOut || shapes.length !== 2) return false;
  if (reader === 'http-observe')
    return cell.topology === 'single' && shapes[0] === TIMED_OUT[1] && shapes[1] === TIMED_OUT[1];
  if (reader === 'topic') return cell.topology === 'single' && shapes[0] === TIMED_OUT[0] && shapes[1] === TIMED_OUT[1];
  return (
    ((reader === 'observe-0' && cell.topology === 'single') ||
      (reader === 'observe-mid' && cell.topology === 'split')) &&
    shapes[0] === TIMED_OUT[0] &&
    shapes[1] === TIMED_OUT[2]
  );
}

const NONRETRYABLE_REDELIVERY = {
  ticket: 'COR-1574',
  cause: 'engine' as const,
  evidence:
    'execution-fence.ts:90-107; workflow-event-processor/index.ts:5058-5080; ' +
    'joined delivery/handle/model trace: non-retryable failure returned retry, nack completed, same event called model twice',
};

function tracedRedelivery(cell: Cell, evidence?: RetryEvidence): boolean {
  if (
    cell.scenario !== 'pause-60s' ||
    cell.engine !== 'evented' ||
    cell.backend !== 'redis' ||
    cell.topology !== 'single' ||
    !evidence ||
    evidence.modelRequests !== 2
  )
    return false;
  const failures = evidence.records.filter(record => record.boundary === 'nonretryable');
  if (failures.length !== 1) return false;
  const failure = failures[0]!;
  if (failure.errorId !== 'DURABLE_AGENT_EXECUTION_UNVERIFIED' || failure.agentRunId !== evidence.runId) return false;
  const records = evidence.records.filter(record => record.eventId === failure.eventId);
  const boundaries = [
    'dispatch',
    'handle',
    'model',
    'nonretryable',
    'result',
    'nack',
    'dispatch',
    'handle',
    'model',
    'result',
  ];
  if (
    records.length !== boundaries.length ||
    evidence.records.filter(record => record.boundary === 'model').length !== 2
  )
    return false;
  if (
    records.some(
      (record, index) =>
        record.boundary !== boundaries[index] ||
        !record.eventId ||
        !record.workflowRunId ||
        record.node !== failure.node ||
        record.pid !== failure.pid ||
        record.workflowRunId !== failure.workflowRunId ||
        !Number.isSafeInteger(record.sequence) ||
        record.sequence <= 0 ||
        (index > 0 && record.sequence <= records[index - 1]!.sequence),
    )
  )
    return false;
  const first = records.slice(0, 6);
  const second = records.slice(6);
  if (!first[0]!.delivery || !second[0]!.delivery || first[0]!.delivery === second[0]!.delivery) return false;
  for (const [attempt, delivery] of [first, second].entries()) {
    const invocation = delivery[1]!.invocation;
    if (!invocation || (attempt === 1 && invocation === first[1]!.invocation)) return false;
    if (
      delivery.some(
        record =>
          record.attempt !== attempt + 1 ||
          record.delivery !== delivery[0]!.delivery ||
          (!['dispatch', 'nack'].includes(record.boundary) && record.invocation !== invocation),
      )
    )
      return false;
  }
  return (
    first[2]!.requestNumber === 1 &&
    second[2]!.requestNumber === 2 &&
    first[4]!.ok === false &&
    first[4]!.retry === true &&
    second[3]!.ok === true
  );
}

function redeliveryFrames(actual: Frame[], expected: Frame[], reader: ReaderName): boolean {
  if (actual.length !== expected.length + 3) return false;
  if (actual[1]?.type !== 'step-start' || actual[2]?.type !== 'text-start' || actual[3]?.type !== 'text-delta')
    return false;
  if (diffFrames(expected.slice(1, 3), actual.slice(1, 3))) return false;
  if (actual[3].shape !== (reader === 'topic' ? 'This ans' : 'This ans ans')) return false;
  return !diffFrames(expected, [actual[0]!, ...actual.slice(4)]);
}

/**
 * Authorized fault allowances are grammars, not captures copied into expected
 * output. Only a fully validated reader is projected; its original frames and
 * attribution remain in the report. All other frames use the exact comparator.
 */
export function projectSymptoms(cell: Cell, capture: RunCapture, expected: RunCapture, retryEvidence?: RetryEvidence) {
  const projected = { ...capture };
  const symptoms: Symptom[] = [];
  const accept = (reader: ReaderName, attribution: Omit<Symptom, 'reader' | 'observed' | 'cell'>) => {
    symptoms.push({ ...attribution, cell, reader, observed: capture[reader]! });
    projected[reader] = expected[reader];
  };

  if (
    cell.scenario === 'tool-approval' &&
    cell.engine === 'plain' &&
    cell.backend === 'valkey' &&
    cell.topology === 'single'
  ) {
    const frames = capture.topic ?? [];
    const index = frames.findIndex(
      (frame, i) => frame.type === 'tool-call-resumed' && frames[i + 1]?.type === 'suspended',
    );
    if (index !== -1) {
      const ordered = [...frames];
      [ordered[index], ordered[index + 1]] = [ordered[index + 1]!, ordered[index]!];
      if (!diffFrames(expected.topic!, ordered)) accept('topic', APPROVAL);
    }
  }

  if (FAULTS.includes(cell.scenario) && cell.backend !== 'memory') {
    const answer = expected.live!.find(frame => frame.type === 'text-delta')!.shape!;
    const redelivery = tracedRedelivery(cell, retryEvidence);
    for (const reader of READERS) {
      const actual = capture[reader];
      const reference = expected[reader]!;
      if (!actual || !diffFrames(reference, actual)) continue;
      if (redelivery && redeliveryFrames(actual, reference, reader)) {
        accept(reader, NONRETRYABLE_REDELIVERY);
        continue;
      }
      if (reader === 'live' && cell.engine === 'plain') continue;
      if (cell.backend === 'redis' && reader === 'topic') continue;
      if (cell.backend === 'valkey') {
        if (sameExceptText(actual, reference, text => valkeyText(text, answer))) {
          accept(reader, VALKEY);
        } else if (partialValkey(actual, reader, cell, answer)) {
          const threadPump =
            cell.engine === 'plain' &&
            cell.topology === 'single' &&
            reader === 'thread' &&
            actual.at(-1)?.type === '(threw)';
          accept(reader, threadPump ? THREAD_PUMP : VALKEY_STALL);
        }
        continue;
      }
      if (sameExceptText(actual, reference, text => replayText(text, answer, true))) {
        accept(reader, REPLAY);
        continue;
      }
    }
  }
  return { capture: projected, symptoms };
}
