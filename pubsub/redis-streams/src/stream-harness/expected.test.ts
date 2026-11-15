import { describe, expect, it } from 'vitest';

import { compareRun } from './compare';
import {
  baselineFrames,
  checkCell,
  expectedCapture,
  knownDifferencesFor,
  observationFor,
  parseFrames,
} from './expected';
import { UNFILED, UNFILED_DIFFERENCES } from './known-differences';
import { normalise } from './normalise';
import { getScenario, SCENARIO_NAMES } from './scenarios';
import { LAYOUTS, READERS } from './types';
import type { Cell, Frame, RunCapture } from './types';

// These run the real observations file against hand-built captures, so they
// prove what the grid would do with a capture that drifts, without Redis.

const durable = (backend: Cell['backend'], scenario = 'tool-undefined'): Cell => ({
  scenario,
  engine: 'durable',
  backend,
  topology: 'single',
});
const plainOf = (cell: Cell): Cell => ({ ...cell, engine: 'plain' });
const clone = (capture: RunCapture): RunCapture => JSON.parse(JSON.stringify(capture));
const types = (frames: Frame[] | undefined) => (frames ?? []).map(f => f.type).join(',');

const iterationStartTopics = {
  'tool-approval':
    'start,iteration-start,step-start,tool-call-input-streaming-start,tool-call-delta,tool-call-delta,tool-call-delta,tool-call-delta,tool-call-delta,tool-call-input-streaming-end,tool-call,tool-call-approval,suspended,tool-call-resumed,tool-result[{"value":"found:harness"}],step-finish,iteration-complete,iteration-start,step-start,text-start,text-delta[The lookup found it.],text-end,step-finish,iteration-complete,finish',
  'run-id-reuse':
    'start,iteration-start,step-start,text-start,text-delta[First answer.],text-end,step-finish,iteration-complete,finish,start,iteration-start,step-start,text-start,text-delta[Second answer.],text-end,step-finish,iteration-complete,finish',
  abort: 'start,iteration-start,step-start,text-start,text-delta,finish',
  'direct-abort': 'start,iteration-start,step-start,text-start,text-delta,finish',
  'structured-output':
    'start,iteration-start,step-start,text-start,text-delta[{"answer":"forty-two"}],text-end,step-finish,iteration-complete,finish',
  'structured-invalid':
    'start,iteration-start,step-start,text-start,text-delta[{"answer":42}],text-end,step-finish,iteration-complete,finish',
  'tool-throws':
    'start,iteration-start,step-start,tool-call-input-streaming-start,tool-call-delta,tool-call-input-streaming-end,tool-call,tool-error,step-finish,iteration-complete,iteration-start,step-start,text-start,text-delta[The tool failed.],text-end,step-finish,iteration-complete,finish',
  'tool-undefined':
    'start,iteration-start,step-start,tool-call-input-streaming-start,tool-call-delta,tool-call-input-streaming-end,tool-call,tool-result,step-finish,iteration-complete,iteration-start,step-start,text-start,text-delta[The tool returned nothing.],text-end,step-finish,iteration-complete,finish',
  'input-tripwire': 'start,iteration-start,tripwire[blocked by harness],iteration-complete,finish',
};
const iterationStartCells: Cell[] = Object.keys(iterationStartTopics).flatMap(scenario =>
  LAYOUTS.flatMap(layout => (['durable', 'evented'] as const).map(engine => ({ scenario, engine, ...layout }))),
);

it('keeps the COR-1557 manifest at eight original plus 76 accepted plus six recovered cells', () => {
  expect(iterationStartCells).toHaveLength(90);
  expect(new Set(iterationStartCells.map(cell => JSON.stringify(cell))).size).toBe(90);
});

it.each(iterationStartCells.filter(cell => cell.scenario === 'input-tripwire'))(
  'accepts only the offset-one tripwire boundary: $engine / $backend / $topology',
  cell => {
    const topic = expectedCapture(cell).topic!;
    expect(topic.map(frame => frame.type)).toEqual([
      'start',
      'iteration-start',
      'tripwire',
      'iteration-complete',
      'finish',
    ]);
    expect(topic[1]).toEqual({ type: 'iteration-start' });
  },
);

// Topic sequences retained from the lifecycle rerun and the full-grid capture, not generated expectations.
describe.each(iterationStartCells)('COR-1557 $scenario / $engine / $backend / $topology', cell => {
  const capturedTopic = () =>
    parseFrames(
      iterationStartTopics[cell.scenario as keyof typeof iterationStartTopics],
      baselineFrames(cell.scenario),
    ).map(frame =>
      frame.type === 'tool-error'
        ? {
            ...frame,
            shape:
              `isError=false keys=${cell.backend === 'memory' ? '__mastraSpanErrorOrigin|' : ''}` +
              'message|name|stack type=object message="kaboom"',
          }
        : frame,
    );

  it('classifies only the evidenced topic boundary and leaves the capture unchanged', () => {
    const capture = clone(expectedCapture(cell));
    capture.topic = capturedTopic();
    const before = clone(capture);
    const { verdict, drift } = checkCell(cell, capture, expectedCapture(plainOf(cell)));
    expect(verdict).toEqual({ unlisted: [], stale: [] });
    expect(drift).toEqual([]);
    expect(capture).toEqual(before);
    const pins = knownDifferencesFor(cell).filter(pin => pin.reader === 'topic');
    const boundaries = pins.filter(pin => pin.evidence.startsWith('iteration-start replay boundary'));
    expect(boundaries).toHaveLength(2);
    expect(boundaries.every(pin => pin.ticket === 'COR-1557' && pin.cause === 'engine')).toBe(true);
  });

  it('preserves the historical topic attribution independently of iteration-start', () => {
    const pins = knownDifferencesFor(cell).filter(
      pin => pin.reader === 'topic' && !pin.evidence.startsWith('iteration-start replay boundary'),
    );
    const unamended = clone(expectedCapture(cell));
    unamended.topic = capturedTopic().filter(frame => frame.type !== 'iteration-start');
    const original = compareRun(cell, unamended, expectedCapture(plainOf(cell)))
      .filter(difference => difference.reader === 'topic')
      .map(difference => {
        const own = observationFor(cell, 'topic');
        const attribution =
          difference.against === 'live'
            ? (own?.againstLive ?? own ?? observationFor(cell, 'live'))
            : (own?.againstPlain ?? own ?? observationFor(plainOf(cell), 'topic'));
        expect(attribution).toBeDefined();
        return {
          against: difference.against,
          ticket: attribution!.ticket,
          cause: attribution!.cause,
          evidence: attribution!.evidence,
        };
      });
    expect(pins.map(({ against, ticket, cause, evidence }) => ({ against, ticket, cause, evidence }))).toEqual(
      original,
    );
    if (cell.scenario === 'structured-output' || cell.scenario === 'structured-invalid') {
      expect(pins.some(pin => pin.ticket === 'COR-1547')).toBe(true);
    }
  });

  it.each(['missing', 'extra', 'moved', 'shaped', 'terminal', 'payload', 'historical', 'reader'])(
    'rejects %s drift beside the authorized boundary',
    mutation => {
      const capture = clone(expectedCapture(cell));
      const topic = capturedTopic();
      capture.topic = topic;
      if (mutation === 'missing') topic.splice(1, 1);
      if (mutation === 'extra') topic.splice(1, 0, { type: 'iteration-start' });
      if (mutation === 'moved') topic.splice(2, 0, ...topic.splice(1, 1));
      if (mutation === 'shaped') topic[1] = { type: 'iteration-start', shape: 'invented' };
      if (mutation === 'terminal') topic.pop();
      if (mutation === 'payload') {
        topic.find(frame => frame.type === 'text-delta' || frame.type === 'tripwire')!.shape = 'invented';
      }
      if (mutation === 'historical') {
        const index = topic.findIndex(frame => frame.type === 'iteration-complete');
        if (index === -1) topic.splice(topic.length - 1, 0, { type: 'abort' });
        else topic.splice(index, 1);
      }
      if (mutation === 'reader') capture['observe-0']!.splice(1, 0, { type: 'iteration-start' });
      const { verdict, drift } = checkCell(cell, capture, expectedCapture(plainOf(cell)));
      expect(verdict.unlisted.length + verdict.stale.length + drift.length).toBeGreaterThan(0);
    },
  );

  it.each(LAYOUTS)('rejects the boundary on plain: $backend / $topology', scope => {
    const other: Cell = { ...cell, ...scope, engine: 'plain' };
    const capture = clone(expectedCapture(other));
    capture.topic = capturedTopic();
    const { verdict, drift } = checkCell(
      other,
      capture,
      other.engine === 'plain' ? undefined : expectedCapture(plainOf(other)),
    );
    expect(verdict.unlisted.length + verdict.stale.length + drift.length).toBeGreaterThan(0);
  });
});

describe('checkCell with the real observations', () => {
  it('passes every grid cell whose capture matches its observations', () => {
    for (const scenario of SCENARIO_NAMES) {
      for (const { backend, topology } of LAYOUTS) {
        for (const engine of ['plain', 'durable', 'evented'] as const) {
          const cell: Cell = { scenario, engine, backend, topology };
          const plain = engine === 'plain' ? undefined : expectedCapture(plainOf(cell));
          const { verdict, drift } = checkCell(cell, expectedCapture(cell), plain);
          expect(verdict, `${scenario} ${engine} ${backend}`).toEqual({ unlisted: [], stale: [] });
          if (getScenario(scenario).fault && backend !== 'memory') {
            expect(drift).toEqual([
              {
                reader: 'live',
                kind: 'stale-symptom',
                detail: 'COR-1561: no pinned fault symptom reproduced',
              },
            ]);
          } else {
            expect(drift).toEqual([]);
          }
        }
      }
    }
  });

  it('fails an unexpected cross-engine difference on a non-live reader while the listed ones still hold', () => {
    const cell = durable('redis');
    const plain = expectedCapture(plainOf(cell));
    const capture = clone(expectedCapture(cell));
    // Durable's topic drops one step-finish: a new difference only that reader shows.
    capture.topic = capture.topic!.filter((f, i) => !(f.type === 'step-finish' && i < 10));

    const { verdict, drift } = checkCell(cell, capture, plain);

    expect(verdict.unlisted.map(d => `${d.reader} vs ${d.against}`).sort()).toEqual([
      'topic vs live',
      'topic vs plain',
    ]);
    expect(drift.map(d => d.reader)).toEqual(['topic']);
  });

  it('fails engine-vs-plain drift even when every reader of the run agrees with its own live stream', () => {
    const cell = durable('valkey');
    const plain = expectedCapture(plainOf(cell));
    // Every durable reader delivers the same thing, which isn't what plain delivers.
    const same: Frame[] = [{ type: 'start' }, { type: 'finish' }];
    const capture = Object.fromEntries(READERS.map(r => [r, same])) as RunCapture;

    const { verdict } = checkCell(cell, capture, plain);

    expect(verdict.unlisted.filter(d => d.against === 'live')).toEqual([]);
    expect(
      verdict.unlisted
        .filter(d => d.against === 'plain')
        .map(d => d.reader)
        .sort(),
    ).toEqual([...READERS].sort());
  });

  it('fails stale when a listed difference is fixed in just one of the cells it applies to', () => {
    const fixed = durable('redis');
    const untouched = durable('valkey');
    // Remove both listed engine markers to make the topic agree with the control.
    expect(types(expectedCapture(fixed).topic)).toContain('iteration-complete');
    expect(types(expectedCapture(fixed).topic)).toContain('iteration-start');

    const capture = clone(expectedCapture(fixed));
    capture.topic = capture.topic!.filter(f => f.type !== 'iteration-complete' && f.type !== 'iteration-start');
    const fixedCheck = checkCell(fixed, capture, expectedCapture(plainOf(fixed)));
    const untouchedCheck = checkCell(untouched, expectedCapture(untouched), expectedCapture(plainOf(untouched)));

    expect(fixedCheck.verdict.unlisted).toEqual([]);
    expect(fixedCheck.verdict.stale.map(d => `${d.ticket} ${d.reader} vs ${d.against}`).sort()).toEqual([
      'COR-1557 topic vs live',
      'COR-1557 topic vs live',
      'COR-1557 topic vs plain',
      'COR-1557 topic vs plain',
    ]);
    expect(fixedCheck.drift.map(d => d.reader)).toEqual(['topic']);
    expect(untouchedCheck).toEqual({ verdict: { unlisted: [], stale: [] }, drift: [] });
  });

  it('fails when every plain reader drifts the same way, which differences alone cannot see', () => {
    const cell: Cell = { scenario: 'tool-undefined', engine: 'plain', backend: 'redis', topology: 'single' };
    const capture = clone(expectedCapture(cell));
    for (const reader of READERS) capture[reader] = capture[reader]!.filter(f => f.type !== 'step-start');

    const { verdict, drift } = checkCell(cell, capture);

    expect(verdict).toEqual({ unlisted: [], stale: [] });
    expect(drift.map(d => d.reader).sort()).toEqual([...READERS].sort());
  });

  it('rejects a changed abort acknowledgement without comparing facts with live frames', () => {
    const cell = durable('redis', 'generate-abort');
    const capture = clone(expectedCapture(cell));
    capture.ack = [{ type: 'ack', shape: 'status=200 aborted=false' }];
    const { verdict, drift } = checkCell(cell, capture, expectedCapture(plainOf(cell)));
    expect(verdict.unlisted.map(d => `${d.reader} vs ${d.against}`)).toEqual(['ack vs plain']);
    expect(drift.map(d => d.reader)).toEqual(['ack']);
    delete capture.generate;
    expect(checkCell(cell, capture, expectedCapture(plainOf(cell))).drift.map(d => d.reader)).toEqual([
      'ack',
      'generate',
    ]);
  });

  it('rejects duplicated resume output even when the original stream is unchanged', () => {
    const cell = durable('redis', 'tool-approval');
    const capture = clone(expectedCapture(cell));
    capture['live-resume']!.push(...capture['live-resume']!);
    const { verdict, drift } = checkCell(cell, capture, expectedCapture(plainOf(cell)));
    expect(verdict.unlisted.map(d => `${d.reader} vs ${d.against}`)).toEqual([
      'live-resume vs live',
      'live-resume vs plain',
    ]);
    expect(drift.map(d => d.reader)).toEqual(['live-resume']);
  });

  it.each([
    { toolName: 'lookup', args: { query: 'corrupted' } },
    { toolName: 'nothing', args: { query: 'harness' } },
  ])('rejects corrupted raw tool calls after normalization: %j', payload => {
    const cell: Cell = { scenario: 'tool-approval', engine: 'plain', backend: 'redis', topology: 'single' };
    const capture = clone(expectedCapture(cell));
    const replaceCall = (value: { toolName: string; args: object }) => {
      const [call] = normalise([{ type: 'tool-call', payload: value }]);
      capture.live = capture.live!.map(frame => (frame.type === 'tool-call' ? call! : frame));
    };
    replaceCall({ toolName: 'lookup', args: { query: 'harness' } });
    expect(checkCell(cell, capture)).toEqual({ verdict: { unlisted: [], stale: [] }, drift: [] });
    replaceCall(payload);
    expect(checkCell(cell, capture).drift).toEqual([
      expect.objectContaining({ reader: 'live', kind: 'shape', detail: expect.stringContaining('tool-call#') }),
    ]);
  });

  it('rejects a same-key error message mutation after normalization', () => {
    const cell = durable('redis', 'tool-throws');
    const plain = expectedCapture(plainOf(cell));
    const capture = clone(expectedCapture(cell));
    const replaceError = (message: string) => {
      const [error] = normalise([
        { type: 'tool-error', payload: { error: { message, name: 'Error', stack: 'not compared' } } },
      ]);
      capture.live = capture.live!.map(frame => (frame.type === 'tool-error' ? error! : frame));
    };
    replaceError('kaboom');
    expect(checkCell(cell, capture, plain)).toEqual({ verdict: { unlisted: [], stale: [] }, drift: [] });
    replaceError('unrelated failure');
    expect(checkCell(cell, capture, plain).drift).toEqual([
      expect.objectContaining({ reader: 'live', kind: 'shape', detail: expect.stringContaining('unrelated failure') }),
    ]);
  });

  it('parses streamed argument fragments without counting quoted braces or commas as frame delimiters', () => {
    const deltas = ['{"qu', 'ery"', ':"ha', 'rnes', 's"}', '],{\\"'];
    const compact = deltas.map(delta => `tool-call-delta[${JSON.stringify(delta)}]`).join(',') + ',finish';
    expect(parseFrames(compact)).toEqual([
      ...normalise(deltas.map(argsTextDelta => ({ type: 'tool-call-delta', payload: { argsTextDelta } }))),
      { type: 'finish' },
    ]);
  });

  it.each(['live', 'all'] as const)('rejects streamed tool argument corruption affecting %s readers', affected => {
    const cell: Cell = { scenario: 'tool-approval', engine: 'plain', backend: 'redis', topology: 'single' };
    const capture = clone(expectedCapture(cell));
    const replaceDelta = (argsTextDelta: string) => {
      const [delta] = normalise([{ type: 'tool-call-delta', payload: { argsTextDelta } }]);
      for (const reader of affected === 'live' ? ['live' as const] : READERS) {
        const index = capture[reader]!.findIndex(frame => frame.type === 'tool-call-delta');
        capture[reader]![index] = delta!;
      }
    };
    replaceDelta('{"qu');
    expect(checkCell(cell, capture)).toEqual({ verdict: { unlisted: [], stale: [] }, drift: [] });
    replaceDelta('{"NO');
    const { verdict, drift } = checkCell(cell, capture);
    expect(drift).toContainEqual(
      expect.objectContaining({ reader: 'live', kind: 'shape', detail: expect.stringContaining('tool-call-delta#') }),
    );
    if (affected === 'all') {
      expect(verdict.unlisted).toEqual([]);
      expect(drift).toHaveLength(READERS.length);
    }
  });

  it('lists every difference still waiting for a ticket', () => {
    expect(Object.keys(UNFILED_DIFFERENCES)).toEqual(['plain input tripwire never published or closed']);
    for (const a of Object.values(UNFILED_DIFFERENCES)) expect(a.ticket).toBe(UNFILED);
  });
});
