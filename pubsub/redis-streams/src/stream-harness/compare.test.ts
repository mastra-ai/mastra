import { describe, expect, it } from 'vitest';

import { compareRun, judgeCell } from './compare';
import type { Cell, Frame, KnownDifference } from './types';

const f = (...types: string[]): Frame[] => types.map(type => ({ type }));
const plainCell: Cell = { scenario: 's', engine: 'plain', backend: 'redis', topology: 'single' };
const durableCell: Cell = { ...plainCell, engine: 'durable' };

describe('compareRun', () => {
  it('reports nothing when every reader and engine agree', () => {
    const live = f('start', 'finish');
    const run = { live, topic: live, 'observe-0': live };
    expect(compareRun(durableCell, run, run)).toEqual([]);
  });

  it('reports a reader that disagrees with its own live stream', () => {
    const [difference] = compareRun(plainCell, { live: f('start', 'finish'), topic: f('start') });
    expect(difference).toMatchObject({ reader: 'topic', against: 'live', kind: 'sequence' });
    expect(difference!.detail).toBe('expected start,finish got start');
  });

  it('reports a shape difference when frame types match', () => {
    const live: Frame[] = [{ type: 'error', shape: 'isError=true' }];
    const replay: Frame[] = [{ type: 'error', shape: 'isError=false' }];
    const [difference] = compareRun(plainCell, { live, 'observe-0': replay });
    expect(difference).toMatchObject({ reader: 'observe-0', kind: 'shape' });
    expect(difference!.detail).toBe('error#0: expected isError=true got isError=false');
  });

  it("reports an engine whose live stream differs from plain's", () => {
    const [difference] = compareRun(durableCell, { live: f('start', 'x', 'finish') }, { live: f('start', 'finish') });
    expect(difference).toMatchObject({ reader: 'live', against: 'plain', kind: 'sequence' });
  });

  it("compares every reader with plain's same reader, not only live", () => {
    // topic agrees with its own live stream but not with plain's topic.
    const run = { live: f('start', 'finish'), topic: f('start', 'finish') };
    const plain = { live: f('start', 'finish'), topic: f('start', 'step-finish', 'finish') };
    expect(compareRun(durableCell, run, plain)).toEqual([
      expect.objectContaining({
        reader: 'topic',
        against: 'plain',
        detail: 'expected start,step-finish,finish got start,finish',
      }),
    ]);
  });

  it('refuses to compare a non-plain engine without plain', () => {
    expect(() => compareRun(durableCell, { live: f('start') })).toThrow(/plain live capture/);
    expect(() => compareRun(durableCell, { live: f('start'), topic: f('start') }, { live: f('start') })).toThrow(
      /plain topic capture/,
    );
  });
});

describe('judgeCell', () => {
  const observed = compareRun(plainCell, { live: f('start', 'finish'), topic: f('start') });
  const entry: KnownDifference = {
    scenario: 's',
    engine: 'plain',
    reader: 'topic',
    against: 'live',
    kind: 'sequence',
    detail: 'expected start,finish got start',
    ticket: 'COR-0',
    cause: 'plain-layer',
    evidence: 'test',
  };

  it('accepts a listed difference', () => {
    expect(judgeCell(plainCell, observed, [entry])).toEqual({ unlisted: [], stale: [] });
  });

  it('fails an unlisted difference', () => {
    expect(judgeCell(plainCell, observed, []).unlisted).toEqual(observed);
  });

  it('fails a listed difference whose detail no longer matches', () => {
    const verdict = judgeCell(plainCell, observed, [{ ...entry, detail: 'expected start,finish got finish' }]);
    expect(verdict.unlisted).toEqual(observed);
    expect(verdict.stale).toHaveLength(1);
  });

  it('fails a listed difference that stops reproducing', () => {
    expect(judgeCell(plainCell, [], [entry]).stale).toEqual([entry]);
  });

  it('requires a backend-wide entry to reproduce on every backend', () => {
    const memoryCell: Cell = { ...plainCell, backend: 'memory' };
    expect(judgeCell(memoryCell, [], [entry]).stale).toEqual([entry]);
    expect(judgeCell(memoryCell, [], [{ ...entry, backend: 'redis' }]).stale).toEqual([]);
  });

  it('fails an unexpected non-live engine difference even when the other differences are listed', () => {
    const plain = { live: f('start', 'finish'), topic: f('start', 'finish'), 'observe-0': f('start', 'finish') };
    const run = {
      live: f('start', 'x', 'finish'),
      topic: f('start', 'x', 'finish'),
      'observe-0': f('start', 'finish'),
    };
    const observed = compareRun(durableCell, run, plain);
    const listed = observed
      .filter(d => d.reader !== 'topic')
      .map(d => ({ ...d, ticket: 'COR-1', cause: 'engine' as const, evidence: 'unit test' }));
    const verdict = judgeCell(durableCell, observed, listed);
    expect(verdict.stale).toEqual([]);
    expect(verdict.unlisted).toEqual([
      expect.objectContaining({
        reader: 'topic',
        against: 'plain',
        detail: 'expected start,finish got start,x,finish',
      }),
    ]);
  });

  it('ignores entries for other cells', () => {
    expect(judgeCell(plainCell, [], [{ ...entry, engine: 'durable' }])).toEqual({ unlisted: [], stale: [] });
  });
});
