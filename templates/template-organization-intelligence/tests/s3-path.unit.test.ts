import { describe, expect, it } from 'vitest';
import { trimSlashes } from '../src/mastra/workspaces/s3-source.js';

describe('trimSlashes', () => {
  it.each([
    ['', ''],
    ['/', ''],
    ['///', ''],
    ['policies', 'policies'],
    ['/policies/', 'policies'],
    ['//policies//guide.md//', 'policies//guide.md'],
  ])('trims %j to %j', (input, expected) => {
    expect(trimSlashes(input)).toBe(expected);
  });

  it('handles a long inner slash run in linear time', () => {
    const inner = `a${'/'.repeat(200_000)}b`;
    const started = performance.now();
    expect(trimSlashes(`/${inner}/`)).toBe(inner);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
