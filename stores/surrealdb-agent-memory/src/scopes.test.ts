import { describe, expect, it } from 'vitest';
import { memoryLens, memoryScopes } from './scopes';

describe('memoryScopes', () => {
  it('uses one complete path per clause', () => {
    expect(memoryScopes('mastra', 'user-1', 'thread-1')).toEqual([
      ['mastra/resource/user-1'],
      ['mastra/thread/thread-1'],
    ]);
  });

  it('keeps ids that match path words distinct', () => {
    // As separate path segments these used to collapse into the same clause.
    expect(memoryScopes('mastra', 'mastra', 't')[0]).not.toEqual(memoryScopes('mastra', 'resource', 't')[0]);
    expect(memoryLens('mastra', 'resource', undefined)).toEqual([['mastra/resource/resource']]);
  });

  it('encodes ids so they cannot add path segments or become a wildcard', () => {
    expect(memoryLens('mastra', '*', undefined)).toEqual([['mastra/resource/%2A']]);
    expect(memoryLens('mastra', 'a/*', undefined)).toEqual([['mastra/resource/a%2F%2A']]);
    expect(memoryLens('mastra', undefined, '../x')).toEqual([['mastra/thread/..%2Fx']]);
  });

  it('normalises slashes around the prefix', () => {
    expect(memoryLens('/org/acme/', 'u', undefined)).toEqual([['org/acme/resource/u']]);
    expect(memoryLens('///', 'u', undefined)).toEqual([['/resource/u']]);
    expect(memoryLens(`${'/'.repeat(100_000)}x`, 'u', undefined)).toEqual([['x/resource/u']]);
  });
});
