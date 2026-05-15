import { describe, it, expect } from 'vitest';
import { hasIncompleteToolCallParts, stripThreadTags } from '../message-utils';

describe('stripThreadTags', () => {
  it('removes <thread> open tags with attributes', () => {
    expect(stripThreadTags('<thread id="abc">hello')).toBe('hello');
    expect(stripThreadTags('<thread>hello')).toBe('hello');
  });

  it('removes </thread> close tags', () => {
    expect(stripThreadTags('hello</thread>')).toBe('hello');
  });

  it('removes both open and close tags, trimming whitespace', () => {
    expect(stripThreadTags('  <thread id="1">hello world</thread>  ')).toBe('hello world');
  });

  it('is case-insensitive', () => {
    expect(stripThreadTags('<THREAD>hello</Thread>')).toBe('hello');
  });

  it('leaves unrelated angle-bracket text alone', () => {
    expect(stripThreadTags('<threading> kept')).toBe('<threading> kept');
    expect(stripThreadTags('a < b && c > d')).toBe('a < b && c > d');
  });

  it('runs in linear time on pathological input (no ReDoS)', () => {
    const input = '<thread'.repeat(5_000);
    stripThreadTags('<thread'.repeat(100)); // warm up JIT
    const start = performance.now();
    stripThreadTags(input);
    const elapsed = performance.now() - start;
    // Generous budget — linear implementation finishes in a few ms;
    // a quadratic implementation would take multiple seconds.
    expect(elapsed).toBeLessThan(2000);
  });
});

function oldGuard(parts: unknown[]): boolean {
  return parts.some((part: any) => part?.type === 'tool-invocation' && part?.toolInvocation?.state === 'call');
}

describe('hasIncompleteToolCallParts', () => {
  it('returns true for tool-invocation state:call', () => {
    const parts = [{ type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'tc-1' } }];
    expect(hasIncompleteToolCallParts(parts)).toBe(true);
  });

  it('returns true for tool-invocation state:partial-call', () => {
    const parts = [{ type: 'tool-invocation', toolInvocation: { state: 'partial-call', toolCallId: 'tc-2' } }];
    expect(oldGuard(parts)).toBe(false);
    expect(hasIncompleteToolCallParts(parts)).toBe(true);
  });

  it('returns false for tool-invocation state:result', () => {
    const parts = [{ type: 'tool-invocation', toolInvocation: { state: 'result', toolCallId: 'tc-3' } }];
    expect(hasIncompleteToolCallParts(parts)).toBe(false);
  });

  it('returns true for raw tool-call part (missed by old guard)', () => {
    const parts = [{ type: 'tool-call', toolCallId: 'tc-client-1', toolName: 'clientTool', args: {} }];
    expect(oldGuard(parts)).toBe(false);
    expect(hasIncompleteToolCallParts(parts)).toBe(true);
  });

  it('returns false for raw tool-result part', () => {
    const parts = [{ type: 'tool-result', toolCallId: 'tc-client-1', result: 'done' }];
    expect(hasIncompleteToolCallParts(parts)).toBe(false);
  });

  it('returns true when any part is an incomplete call among mixed parts', () => {
    const parts = [
      { type: 'text', text: 'Here is the result:' },
      { type: 'tool-call', toolCallId: 'tc-2', toolName: 'clientTool', args: {} },
    ];
    expect(hasIncompleteToolCallParts(parts)).toBe(true);
  });

  it('returns false when all parts are text or completed results', () => {
    const parts = [
      { type: 'text', text: 'Done.' },
      { type: 'tool-result', toolCallId: 'tc-3', result: 'ok' },
    ];
    expect(hasIncompleteToolCallParts(parts)).toBe(false);
  });

  it('returns false for empty parts array', () => {
    expect(hasIncompleteToolCallParts([])).toBe(false);
  });
});
