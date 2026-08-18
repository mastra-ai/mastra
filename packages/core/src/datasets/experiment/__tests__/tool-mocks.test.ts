import { describe, it, expect } from 'vitest';
import { ToolMockMatcher, TOOL_MOCK_MISMATCH, TOOL_MOCK_EXHAUSTED, TOOL_MOCK_NOT_DECLARED } from '../tool-mocks';
import type { ItemToolMock } from '../tool-mocks';

describe('ToolMockMatcher', () => {
  it('hasMocks reflects whether the item declares any mock', () => {
    expect(new ToolMockMatcher(undefined).hasMocks).toBe(false);
    expect(new ToolMockMatcher([]).hasMocks).toBe(false);
    expect(new ToolMockMatcher([{ toolName: 'a', args: {}, output: 1 }]).hasMocks).toBe(true);
  });

  it('serves a matching mock and skips live execution', () => {
    const matcher = new ToolMockMatcher([{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }]);

    const res = matcher.resolve('getWeather', { city: 'Seattle' });

    expect(res).toEqual({ kind: 'serve', output: { temp: 52 } });
    const report = matcher.report();
    expect(report.served).toEqual([{ mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } }]);
    expect(report.unconsumed).toEqual([]);
    expect(report.failure).toBeUndefined();
  });

  it('matches args independent of object key order (strict deep equal)', () => {
    const matcher = new ToolMockMatcher([{ toolName: 't', args: { a: 1, b: 2 }, output: 'ok' }]);
    expect(matcher.resolve('t', { b: 2, a: 1 })).toEqual({ kind: 'serve', output: 'ok' });
  });

  it('does not coerce args (number vs string mismatch)', () => {
    const matcher = new ToolMockMatcher([{ toolName: 't', args: { n: 1 }, output: 'ok' }]);
    expect(matcher.resolve('t', { n: '1' })).toEqual({ kind: 'fail', code: TOOL_MOCK_MISMATCH });
  });

  it('treats array order as significant', () => {
    const matcher = new ToolMockMatcher([{ toolName: 't', args: { xs: [1, 2] }, output: 'ok' }]);
    expect(matcher.resolve('t', { xs: [2, 1] })).toEqual({ kind: 'fail', code: TOOL_MOCK_MISMATCH });
    expect(
      new ToolMockMatcher([{ toolName: 't', args: { xs: [1, 2] }, output: 'ok' }]).resolve('t', { xs: [1, 2] }),
    ).toEqual({
      kind: 'serve',
      output: 'ok',
    });
  });

  it('fails with MISMATCH when a mocked tool is called with unknown args', () => {
    const matcher = new ToolMockMatcher([{ toolName: 'getWeather', args: { city: 'Seattle' }, output: 1 }]);
    const res = matcher.resolve('getWeather', { city: 'Paris' });
    expect(res).toEqual({ kind: 'fail', code: TOOL_MOCK_MISMATCH });
    expect(matcher.report().failure).toEqual({
      code: TOOL_MOCK_MISMATCH,
      toolName: 'getWeather',
      args: { city: 'Paris' },
    });
  });

  it('fails with EXHAUSTED when matching args are called more times than provided', () => {
    const matcher = new ToolMockMatcher([{ toolName: 'write', args: { f: 'a' }, output: 'first' }]);
    expect(matcher.resolve('write', { f: 'a' })).toEqual({ kind: 'serve', output: 'first' });
    expect(matcher.resolve('write', { f: 'a' })).toEqual({ kind: 'fail', code: TOOL_MOCK_EXHAUSTED });
  });

  it('consumes duplicate same-args mocks in declared order', () => {
    const mocks: ItemToolMock[] = [
      { toolName: 'write', args: { f: 'a' }, output: 'first' },
      { toolName: 'write', args: { f: 'a' }, output: 'second' },
    ];
    const matcher = new ToolMockMatcher(mocks);
    expect(matcher.resolve('write', { f: 'a' })).toEqual({ kind: 'serve', output: 'first' });
    expect(matcher.resolve('write', { f: 'a' })).toEqual({ kind: 'serve', output: 'second' });
  });

  it('orders consumption per (tool,args) independently across different args', () => {
    // mocks: Seattle->52, Paris->60, Seattle->48
    const matcher = new ToolMockMatcher([
      { toolName: 'w', args: { city: 'Seattle' }, output: 52 },
      { toolName: 'w', args: { city: 'Paris' }, output: 60 },
      { toolName: 'w', args: { city: 'Seattle' }, output: 48 },
    ]);
    // calls: Seattle, Seattle, Paris -> 52, 48, 60
    expect(matcher.resolve('w', { city: 'Seattle' })).toEqual({ kind: 'serve', output: 52 });
    expect(matcher.resolve('w', { city: 'Seattle' })).toEqual({ kind: 'serve', output: 48 });
    expect(matcher.resolve('w', { city: 'Paris' })).toEqual({ kind: 'serve', output: 60 });
  });

  it('runs unmocked tools live and records them in the report', () => {
    const matcher = new ToolMockMatcher([{ toolName: 'mocked', args: {}, output: 1 }]);
    expect(matcher.resolve('other', { x: 1 })).toEqual({ kind: 'live' });
    const report = matcher.report();
    expect(report.liveCalls).toEqual([{ toolName: 'other', args: { x: 1 } }]);
    // the declared mock was never used → unconsumed, but no failure
    expect(report.unconsumed).toEqual([{ mockIndex: 0, toolName: 'mocked', args: {} }]);
    expect(report.failure).toBeUndefined();
  });

  it('denies undeclared tools without recording a live call', () => {
    const matcher = new ToolMockMatcher([{ toolName: 'mocked', args: {}, output: 1 }], 'deny');

    expect(matcher.resolve('other', { x: 1 })).toEqual({ kind: 'fail', code: TOOL_MOCK_NOT_DECLARED });
    expect(matcher.report()).toMatchObject({
      liveCalls: [],
      failure: { code: TOOL_MOCK_NOT_DECLARED, toolName: 'other', args: { x: 1 } },
    });
  });

  it('denies undeclared tools even when no mocks are declared', () => {
    const matcher = new ToolMockMatcher(undefined, 'deny');

    expect(matcher.hasMocks).toBe(false);
    expect(matcher.resolve('other', {})).toEqual({ kind: 'fail', code: TOOL_MOCK_NOT_DECLARED });
  });

  it('reports unconsumed mocks without failing (report-only)', () => {
    const matcher = new ToolMockMatcher([
      { toolName: 't', args: { a: 1 }, output: 'x' },
      { toolName: 't', args: { a: 2 }, output: 'y' },
    ]);
    matcher.resolve('t', { a: 1 });
    const report = matcher.report();
    expect(report.served).toHaveLength(1);
    expect(report.unconsumed).toEqual([{ mockIndex: 1, toolName: 't', args: { a: 2 } }]);
    expect(report.failure).toBeUndefined();
  });

  it('keeps the first failure only', () => {
    const matcher = new ToolMockMatcher([{ toolName: 't', args: { a: 1 }, output: 'x' }]);
    matcher.resolve('t', { a: 99 }); // mismatch
    matcher.resolve('t', { a: 1 }); // would serve, but failure already recorded
    expect(matcher.report().failure).toEqual({ code: TOOL_MOCK_MISMATCH, toolName: 't', args: { a: 99 } });
  });

  it('fails every resolution after the first failure, even for other tools with available mocks', () => {
    const matcher = new ToolMockMatcher([
      { toolName: 'a', args: { x: 1 }, output: 'a-out' },
      { toolName: 'b', args: { y: 1 }, output: 'b-out' },
    ]);
    // Tool A is called with wrong args → mismatch failure recorded.
    expect(matcher.resolve('a', { x: 99 })).toEqual({ kind: 'fail', code: TOOL_MOCK_MISMATCH });
    // Tool B has an unconsumed, matching mock, but the item is already doomed:
    // resolve must fail (not serve) so no further tool runs during abort propagation.
    expect(matcher.resolve('b', { y: 1 })).toEqual({ kind: 'fail', code: TOOL_MOCK_MISMATCH });
    // An unmocked tool must also fail (not run live) after a failure.
    expect(matcher.resolve('unmocked', { z: 1 })).toEqual({ kind: 'fail', code: TOOL_MOCK_MISMATCH });
    const report = matcher.report();
    // B's mock was never served; no live call was recorded.
    expect(report.served).toEqual([]);
    expect(report.liveCalls).toEqual([]);
    expect(report.failure).toEqual({ code: TOOL_MOCK_MISMATCH, toolName: 'a', args: { x: 99 } });
  });

  it("matchArgs 'ignore' serves regardless of the call args", () => {
    const matcher = new ToolMockMatcher([
      {
        toolName: 'agent-balanceAgent',
        args: { prompt: 'authored at record time' },
        output: { text: 'YJ: $100' },
        matchArgs: 'ignore',
      },
    ]);
    // Different prompt + runtime-injected fields → still serves.
    const res = matcher.resolve('agent-balanceAgent', { prompt: 'totally different', threadId: 'x', maxSteps: 5 });
    expect(res).toEqual({ kind: 'serve', output: { text: 'YJ: $100' } });
    expect(matcher.report().failure).toBeUndefined();
  });

  it("matchArgs 'ignore' still consumes in declared order and reports EXHAUSTED when overcalled", () => {
    const matcher = new ToolMockMatcher([
      { toolName: 'sub', args: {}, output: 'first', matchArgs: 'ignore' },
      { toolName: 'sub', args: {}, output: 'second', matchArgs: 'ignore' },
    ]);
    expect(matcher.resolve('sub', { a: 1 })).toEqual({ kind: 'serve', output: 'first' });
    expect(matcher.resolve('sub', { b: 2 })).toEqual({ kind: 'serve', output: 'second' });
    expect(matcher.resolve('sub', { c: 3 })).toEqual({ kind: 'fail', code: TOOL_MOCK_EXHAUSTED });
  });

  it("mixes 'ignore' and 'strict' mocks for the same tool", () => {
    // strict entry first; an ignore entry as a catch-all fallback.
    const matcher = new ToolMockMatcher([
      { toolName: 't', args: { city: 'Seattle' }, output: 'strict-hit' },
      { toolName: 't', args: {}, output: 'ignore-fallback', matchArgs: 'ignore' },
    ]);
    // Exact args → strict entry consumed first.
    expect(matcher.resolve('t', { city: 'Seattle' })).toEqual({ kind: 'serve', output: 'strict-hit' });
    // Different args → strict no longer matches, ignore fallback serves.
    expect(matcher.resolve('t', { city: 'Paris' })).toEqual({ kind: 'serve', output: 'ignore-fallback' });
  });
});
