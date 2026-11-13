import { describe, expect, it } from 'vitest';

import { checkCell, expectedCapture } from './expected';
import type { Cell, Frame, ReaderName, RunCapture } from './types';

const cell: Cell = { scenario: 'pause-5s', engine: 'plain', backend: 'redis', topology: 'split' };
const captureFor = (testCell: Cell) => structuredClone(expectedCapture(testCell));
const textFrame = (capture: RunCapture, reader: ReaderName) =>
  capture[reader]!.find(frame => frame.type === 'text-delta')!;
const pass = (testCell: Cell, capture: RunCapture, plain?: RunCapture) => {
  const check = checkCell(testCell, capture, plain);
  return check.verdict.unlisted.length + check.verdict.stale.length + check.drift.length === 0;
};

// Policies must accept the ticketed symptoms without hiding a new user-visible
// failure. Real transport reproductions live in the engine/backend fault grid.
describe('authorized transport symptoms', () => {
  it.each(['This ans answer', 'This ans ans answer'])(
    'pins repeated replay chunks without fixing their capture: %s',
    prefix => {
      const capture = captureFor(cell);
      textFrame(capture, 'observe-mid').shape = textFrame(capture, 'live').shape!.replace('This answer', prefix);
      const before = structuredClone(capture);
      const check = checkCell(cell, capture);
      expect(pass(cell, capture)).toBe(true);
      expect(check.symptoms).toEqual([
        expect.objectContaining({ ticket: 'COR-1561', cause: 'plain-layer', reader: 'observe-mid' }),
      ]);
      expect(check.rawDifferences).toEqual([expect.objectContaining({ reader: 'observe-mid', kind: 'shape' })]);
      expect(capture).toEqual(before);
    },
  );

  it.each(['', 'This ans', 'This imaginary answer', 'This answer streams backwards.'])(
    'does not call missing or invented Redis text replay duplication: %j',
    text => {
      const capture = captureFor(cell);
      textFrame(capture, 'observe-mid').shape = text;
      expect(pass(cell, capture)).toBe(false);
    },
  );

  it.each(['live', 'topic'] as const)(
    'rejects duplicate Redis text at a boundary not covered by the ticket: %s',
    reader => {
      const capture = captureFor(cell);
      textFrame(capture, reader).shape = textFrame(capture, reader).shape!.replace('This answer', 'This ans answer');
      expect(pass(cell, capture)).toBe(false);
    },
  );

  it('keeps a fixed fault symptom stale instead of silently going green', () => {
    expect(checkCell(cell, captureFor(cell)).drift).toEqual([
      expect.objectContaining({ kind: 'stale-symptom', detail: expect.stringContaining('no pinned fault symptom') }),
    ]);
  });

  it.each(['start', 'text-end', 'step-finish', 'finish'])(
    'does not hide a missing Redis boundary frame behind repeated text: %s',
    removed => {
      const capture = captureFor(cell);
      textFrame(capture, 'observe-mid').shape = textFrame(capture, 'live').shape!.replace(
        'This answer',
        'This ans answer',
      );
      capture['observe-mid'] = capture['observe-mid']!.filter(frame => frame.type !== removed);
      expect(pass(cell, capture)).toBe(false);
    },
  );

  it('preserves exact COR-1557 checks while allowing a replay-backed durable caller to duplicate', () => {
    const durable: Cell = { ...cell, engine: 'durable' };
    const capture = captureFor(durable);
    const plain = captureFor(cell);
    textFrame(plain, 'observe-mid').shape = textFrame(plain, 'live').shape!.replace('This answer', 'This ans answer');
    textFrame(capture, 'live').shape = textFrame(capture, 'live').shape!.replace('This answer', 'This ans ans answer');
    expect(pass(durable, capture, plain)).toBe(true);
    capture.topic = capture.topic!.filter(frame => frame.type !== 'iteration-complete');
    expect(pass(durable, capture, plain)).toBe(false);
    expect(checkCell(durable, capture, plain).verdict.stale.map(entry => entry.ticket)).toContain('COR-1557');
  });

  it('pins Valkey missing history and stalled caller as untraced, not as a diagnosed Redis replay', () => {
    const valkey: Cell = { ...cell, engine: 'durable', backend: 'valkey' };
    const capture = captureFor(valkey);
    capture.live = [...capture.live!.slice(0, 4), { type: '(timeout)' }];
    textFrame(capture, 'live').shape = 'This';
    capture.topic = [];
    capture['observe-0'] = [];
    capture['http-observe'] = [{ type: '(http 404)', shape: '{"error":"Run not found"}' }];
    const plain = captureFor({ ...valkey, engine: 'plain' });
    expect(pass(valkey, capture, plain)).toBe(true);
    expect(checkCell(valkey, capture, plain).symptoms).toEqual(
      expect.arrayContaining([expect.objectContaining({ ticket: 'COR-1562', cause: 'untraced', reader: 'live' })]),
    );
    capture.live = [];
    expect(pass(valkey, capture, plain)).toBe(false);
  });

  it.each(['unknown error', 'timed out but unrelated', 'kaboom'])(
    'rejects new Valkey errors even while the caller stalls: %s',
    message => {
      const valkey: Cell = { ...cell, engine: 'durable', backend: 'valkey' };
      const capture = captureFor(valkey);
      capture.live = [...capture.live!.slice(0, 4), { type: 'error', shape: message }];
      textFrame(capture, 'live').shape = 'This';
      expect(pass(valkey, capture, captureFor({ ...valkey, engine: 'plain' }))).toBe(false);
    },
  );

  it('rejects a non-adjacent old Redis chunk inserted into a later stream position', () => {
    const capture = captureFor(cell);
    const frame = textFrame(capture, 'observe-mid');
    const answer = frame.shape!;
    frame.shape = answer.slice(0, 48) + 'This' + answer.slice(48);
    expect(pass(cell, capture)).toBe(false);
  });

  it('rejects fabricated Valkey permutations even when the latter half is intact', () => {
    const valkey: Cell = { ...cell, backend: 'valkey' };
    const capture = captureFor(valkey);
    const frame = textFrame(capture, 'observe-mid');
    frame.shape = 'This'.repeat(11) + frame.shape!.slice(48);
    expect(pass(valkey, capture)).toBe(false);
  });

  it.each(['missing timeout', 'three errors', 'error then more text'])(
    'rejects a new Valkey termination/error envelope: %s',
    mutation => {
      const valkey: Cell = { ...cell, engine: 'durable', backend: 'valkey' };
      const capture = captureFor(valkey);
      const error: Frame = {
        type: 'error',
        shape: 'isError=false keys=message|name|stack type=object message="timed out"',
      };
      capture.live = capture.live!.slice(0, 4);
      textFrame(capture, 'live').shape = 'This';
      if (mutation === 'three errors') capture.live.push(error, error, error, { type: '(timeout)' });
      if (mutation === 'error then more text')
        capture.live.push(error, { type: 'text-delta', shape: ' ans' }, { type: '(timeout)' });
      expect(pass(valkey, capture, captureFor({ ...valkey, engine: 'plain' }))).toBe(false);
    },
  );

  it('keeps Valkey reader serialization and error counts exact', () => {
    const valkey: Cell = { ...cell, engine: 'durable', backend: 'valkey', topology: 'single' };
    const capture = captureFor(valkey);
    capture['observe-0'] = capture['observe-0']!.slice(0, 4);
    textFrame(capture, 'observe-0').shape = 'This ans';
    const first: Frame = {
      type: 'error',
      shape: 'isError=false keys=message|name|stack type=object message="timed out"',
    };
    const last: Frame = { type: 'error', shape: 'isError=true keys=name type=object message="timed out"' };
    capture['observe-0']!.push(first, last);
    const plain = captureFor({ ...valkey, engine: 'plain' });
    expect(pass(valkey, capture, plain)).toBe(true);
    capture['observe-0']!.push(last);
    expect(pass(valkey, capture, plain)).toBe(false);
    capture['observe-0']!.pop();
    last.shape = 'isError=false keys=message|name type=object message="timed out"';
    expect(pass(valkey, capture, plain)).toBe(false);
    capture['observe-0'] = [...capture['observe-0']!.slice(0, 4), { type: '(timeout)' }];
    expect(pass(valkey, capture, plain)).toBe(false);
    for (const engine of ['durable', 'evented'] as const) {
      const topicCell = { ...valkey, engine };
      const topicCapture = captureFor(topicCell);
      topicCapture.topic = [...topicCapture.topic!.slice(0, 4), { type: '(timeout)' }];
      textFrame(topicCapture, 'topic').shape = 'This ans';
      expect(pass(topicCell, topicCapture, plain)).toBe(false);
    }
  });

  it('pins only the observed evented text-after-error envelope', () => {
    const valkey: Cell = { ...cell, engine: 'evented', backend: 'valkey' };
    const capture = captureFor(valkey);
    capture['observe-0'] = capture['observe-0']!.slice(0, 4);
    textFrame(capture, 'observe-0').shape = 'This ans';
    const error: Frame = {
      type: 'error',
      shape: 'isError=false keys=message|name|stack type=object message="timed out"',
    };
    const repeated: Frame = { type: 'text-delta', shape: ' ans' };
    capture['observe-0']!.push(error, repeated, error, { type: '(timeout)' });
    const plain = captureFor({ ...valkey, engine: 'plain' });
    expect(pass(valkey, capture, plain)).toBe(true);
    repeated.shape = 'This';
    expect(pass(valkey, capture, plain)).toBe(false);
  });

  it('leaves a second execution attempt unlisted instead of misattributing it to COR-1526', () => {
    const restarted: Cell = { ...cell, engine: 'evented', scenario: 'pause-60s' };
    const capture = captureFor(restarted);
    capture.live!.splice(4, 0, { type: 'step-start' }, { type: 'text-start' }, { type: 'text-delta', shape: 'This' });
    expect(pass(restarted, capture, captureFor({ ...restarted, engine: 'plain' }))).toBe(false);
  });
});

function invertApproval(capture: RunCapture) {
  const frames = capture.topic!;
  const index = frames.findIndex(frame => frame.type === 'suspended');
  const resumed: Frame = frames[index + 1]!;
  frames.splice(index, 2, resumed, frames[index]!);
}

describe('authorized unfiled approval-order exception', () => {
  const approval: Cell = { ...cell, scenario: 'tool-approval', backend: 'valkey', topology: 'single' };
  it('accepts just the adjacent raw-topic inversion and keeps its unfiled status visible', () => {
    const capture = captureFor(approval);
    invertApproval(capture);
    expect(pass(approval, capture)).toBe(true);
    expect(checkCell(approval, capture).symptoms?.[0]?.ticket).toBe('UNFILED_APPROVAL_ORDER');
    textFrame(capture, 'topic').shape = 'corrupted result';
    expect(pass(approval, capture)).toBe(false);
  });
  it('identifies a plain-reference inversion without attributing it to the durable caller', () => {
    const durable: Cell = { ...approval, engine: 'durable' };
    const plain = captureFor(approval);
    invertApproval(plain);
    const check = checkCell(durable, captureFor(durable), plain);
    expect(pass(durable, captureFor(durable), plain)).toBe(true);
    expect(check.symptoms).toEqual([expect.objectContaining({ cell: approval, ticket: 'UNFILED_APPROVAL_ORDER' })]);
  });
  it.each([{ backend: 'redis' }, { topology: 'split' }] as const)(
    'does not broaden the inversion exception to another layout: %j',
    layout => {
      const elsewhere: Cell = { ...approval, ...layout };
      const capture = captureFor(elsewhere);
      invertApproval(capture);
      expect(pass(elsewhere, capture)).toBe(false);
    },
  );
});
