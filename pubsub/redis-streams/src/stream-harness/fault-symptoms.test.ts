import { describe, expect, it } from 'vitest';

import { checkCell, expectedCapture } from './expected';
import type { RetryEvidence, RetryTrace } from './fault-symptoms';
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

  it('attributes Valkey cache/live corruption to COR-1561, not the thread-pump ticket', () => {
    const valkey: Cell = { ...cell, engine: 'durable', backend: 'valkey' };
    const capture = captureFor(valkey);
    const frame = textFrame(capture, 'live');
    frame.shape = frame.shape!.replace('This answer ', 'This ans');
    const plain = captureFor({ ...valkey, engine: 'plain' });
    expect(pass(valkey, capture, plain)).toBe(true);
    expect(checkCell(valkey, capture, plain).symptoms).toEqual(
      expect.arrayContaining([expect.objectContaining({ ticket: 'COR-1561', cause: 'plain-layer', reader: 'live' })]),
    );
    capture.live = [];
    expect(pass(valkey, capture, plain)).toBe(false);
  });

  it('does not attribute an unexplained Valkey caller stall to cache corruption or thread-pump termination', () => {
    const valkey: Cell = { ...cell, engine: 'durable', backend: 'valkey' };
    const capture = captureFor(valkey);
    capture.live = [...capture.live!.slice(0, 4), { type: '(timeout)' }];
    textFrame(capture, 'live').shape = 'This';
    const check = checkCell(valkey, capture, captureFor({ ...valkey, engine: 'plain' }));
    expect(check.symptoms).toEqual([
      expect.objectContaining({ ticket: 'UNATTRIBUTED_VALKEY_STALL', cause: 'untraced', reader: 'live' }),
    ]);
  });

  it('limits COR-1562 to the observed plain single-process Valkey thread-pump termination', () => {
    const valkey: Cell = { ...cell, backend: 'valkey', topology: 'single' };
    const capture = captureFor(valkey);
    capture.thread = [
      ...capture.thread!.slice(0, 4),
      { type: '(threw)', shape: 'isError=true keys=message type=object message="timed out" id=-' },
    ];
    textFrame(capture, 'thread').shape = 'This';
    expect(checkCell(valkey, capture).symptoms).toEqual([
      expect.objectContaining({ ticket: 'COR-1562', cause: 'plain-layer', reader: 'thread' }),
    ]);
    capture.thread!.at(-1)!.shape = 'unrelated termination';
    expect(pass(valkey, capture)).toBe(false);
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

describe('COR-1574 joined redelivery classification', () => {
  const retried: Cell = { scenario: 'pause-60s', engine: 'evented', backend: 'redis', topology: 'single' };

  function fixture() {
    const capture = captureFor(retried);
    for (const [reader, frames] of Object.entries(capture)) {
      frames.splice(
        1,
        0,
        { ...frames[1]! },
        { ...frames[2]! },
        {
          type: 'text-delta',
          shape: reader === 'topic' ? 'This ans' : 'This ans ans',
        },
      );
    }
    const boundaries: RetryTrace['boundary'][] = [
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
    const evidence: RetryEvidence = {
      runId: 'agent-run',
      modelRequests: 2,
      records: boundaries.map((boundary, index) => ({
        node: 'publisher',
        pid: 123,
        sequence: index + 1,
        boundary,
        delivery: index < 6 ? 'delivery-one' : 'delivery-two',
        eventId: 'step-event',
        workflowRunId: 'workflow-run',
        attempt: index < 6 ? 1 : 2,
        ...(!['dispatch', 'nack'].includes(boundary) ? { invocation: index < 6 ? 'handle-one' : 'handle-two' } : {}),
        ...(boundary === 'model' ? { requestNumber: index < 6 ? 1 : 2 } : {}),
        ...(boundary === 'nonretryable'
          ? { errorId: 'DURABLE_AGENT_EXECUTION_UNVERIFIED', agentRunId: 'agent-run' }
          : {}),
        ...(boundary === 'result' ? (index < 6 ? { ok: false, retry: true } : { ok: true }) : {}),
      })),
    };
    const plain = captureFor({ ...retried, engine: 'plain' });
    return { capture, evidence, plain };
  }

  it('attributes the observed second response only with the joined failure, retry settlement and model requests', () => {
    const { capture, evidence, plain } = fixture();
    const original = structuredClone({ capture, evidence });
    const check = checkCell(retried, capture, plain, evidence);
    expect(check.verdict).toEqual({ unlisted: [], stale: [] });
    expect(check.drift).toEqual([]);
    expect(check.symptoms).toHaveLength(Object.keys(capture).length);
    expect(check.symptoms!.every(symptom => symptom.ticket === 'COR-1574' && symptom.cause === 'engine')).toBe(true);
    expect(check.rawDifferences!.length).toBeGreaterThan(0);
    expect({ capture, evidence }).toEqual(original);
    for (const symptom of check.symptoms!) expect(symptom.observed).toEqual(original.capture[symptom.reader]);
  });

  const mutations: { name: string; mutate: (evidence: RetryEvidence) => void }[] = [
    {
      name: 'an unjoined extra model request',
      mutate: e => {
        e.modelRequests = 3;
      },
    },
    {
      name: 'a missing retry settlement',
      mutate: e => {
        e.records.splice(4, 1);
      },
    },
    {
      name: 'a terminal rather than retryable settlement',
      mutate: e => {
        e.records[4]!.retry = false;
      },
    },
    {
      name: 'a missing completed nack',
      mutate: e => {
        e.records.splice(5, 1);
      },
    },
    {
      name: 'a different redelivered event',
      mutate: e => {
        e.records[6]!.eventId = 'other-event';
      },
    },
    {
      name: 'an unrelated agent run',
      mutate: e => {
        e.records[3]!.agentRunId = 'other-run';
      },
    },
    {
      name: 'a different ownership error',
      mutate: e => {
        e.records[3]!.errorId = 'OTHER_ERROR';
      },
    },
    {
      name: 'a model request outside its handler invocation',
      mutate: e => {
        e.records[8]!.invocation = 'unjoined';
      },
    },
    {
      name: 'a reused delivery identity',
      mutate: e => {
        for (const r of e.records) r.delivery = 'same-delivery';
      },
    },
    {
      name: 'a reused handler invocation',
      mutate: e => {
        for (const r of e.records.slice(6)) r.invocation = 'handle-one';
      },
    },
    {
      name: 'an out-of-order settlement',
      mutate: e => {
        e.records[5]!.sequence = 4;
      },
    },
    {
      name: 'a restarted request counter',
      mutate: e => {
        e.records[8]!.requestNumber = 1;
      },
    },
    {
      name: 'a different workflow run',
      mutate: e => {
        e.records[8]!.workflowRunId = 'other-workflow';
      },
    },
  ];
  it.each(mutations)('rejects $name', ({ mutate }) => {
    const { capture, evidence, plain } = fixture();
    mutate(evidence);
    const check = checkCell(retried, capture, plain, evidence);
    expect(check.symptoms?.some(symptom => symptom.ticket === 'COR-1574') ?? false).toBe(false);
    expect(check.verdict.unlisted.length + check.verdict.stale.length + check.drift.length).toBeGreaterThan(0);
  });

  it.each([{ engine: 'durable' }, { scenario: 'pause-5s' }, { backend: 'valkey' }, { topology: 'split' }] as const)(
    'does not extend the pin to another cell: %j',
    change => {
      const { capture, evidence, plain } = fixture();
      const check = checkCell({ ...retried, ...change }, capture, plain, evidence);
      expect(check.symptoms?.some(symptom => symptom.ticket === 'COR-1574') ?? false).toBe(false);
    },
  );

  it('requires a plain reference even when retry causality is complete', () => {
    const { capture, evidence } = fixture();
    expect(() => checkCell(retried, capture, undefined, evidence)).toThrow(
      'no plain live capture to compare pause-60s / evented / redis / single against',
    );
  });

  it.each(['no evidence', 'missing terminal', 'invented text'] as const)('leaves the capture red with %s', mutation => {
    const { capture, evidence, plain } = fixture();
    if (mutation === 'missing terminal') capture.live!.pop();
    if (mutation === 'invented text') capture.live![3]!.shape = 'invented response';
    const check = checkCell(retried, capture, plain, mutation === 'no evidence' ? undefined : evidence);
    expect(check.verdict.unlisted.length + check.verdict.stale.length + check.drift.length).toBeGreaterThan(0);
    if (mutation === 'missing terminal' || mutation === 'invented text') {
      expect(check.symptoms?.some(symptom => symptom.reader === 'live')).toBe(false);
    } else expect(check.symptoms?.some(symptom => symptom.ticket === 'COR-1574') ?? false).toBe(false);
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
