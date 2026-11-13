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

const FAULTS = ['pause-5s', 'pause-60s', 'connection-reset'];
const REPLAY = {
  ticket: 'COR-1561',
  cause: 'plain-layer',
  evidence:
    'caching-pubsub.ts:294-305,422-454; replay-duplicate-current.txt: successful append loses reply, unindexed delivery is backfilled again',
} as const;
const VALKEY = {
  ticket: 'COR-1562',
  cause: 'untraced',
  evidence:
    'grid.ts:279; p4-fault-grid.txt: Valkey garbled/missing text, timed-out caller and unavailable history; root cause not yet traced',
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

/**
 * Authorized fault allowances are grammars, not captures copied into expected
 * output. Only a fully validated reader is projected; its original frames and
 * attribution remain in the report. All other frames use the exact comparator.
 */
export function projectSymptoms(cell: Cell, capture: RunCapture, expected: RunCapture) {
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
    for (const reader of READERS) {
      const actual = capture[reader];
      const reference = expected[reader]!;
      if (!actual || !diffFrames(reference, actual)) continue;
      if (reader === 'live' && cell.engine === 'plain') continue;
      if (cell.backend === 'redis' && reader === 'topic') continue;
      if (cell.backend === 'valkey') {
        if (
          sameExceptText(actual, reference, text => valkeyText(text, answer)) ||
          partialValkey(actual, reader, cell, answer)
        ) {
          accept(reader, VALKEY);
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
