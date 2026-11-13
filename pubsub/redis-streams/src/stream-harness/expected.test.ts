import { describe, expect, it } from 'vitest';

import { checkCell, expectedCapture, parseFrames } from './expected';
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
                detail: expect.stringContaining('no pinned fault symptom reproduced'),
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
    // The durable topic's extra iteration-complete frames are listed for every layout.
    expect(types(expectedCapture(fixed).topic)).toContain('iteration-complete');

    const capture = clone(expectedCapture(fixed));
    capture.topic = capture.topic!.filter(f => f.type !== 'iteration-complete');
    const fixedCheck = checkCell(fixed, capture, expectedCapture(plainOf(fixed)));
    const untouchedCheck = checkCell(untouched, expectedCapture(untouched), expectedCapture(plainOf(untouched)));

    expect(fixedCheck.verdict.unlisted).toEqual([]);
    expect(fixedCheck.verdict.stale.map(d => `${d.ticket} ${d.reader} vs ${d.against}`).sort()).toEqual([
      'COR-1557 topic vs live',
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
