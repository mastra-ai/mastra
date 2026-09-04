import { describe, expect, it } from 'vitest';
import { MASTRA_INHERITED_MEMORY_KEY, isReservedRequestContextKey } from './constants';

describe('isReservedRequestContextKey', () => {
  it('reserves the inherited-memory key so a request body cannot set it', () => {
    // Agent delegation stores a live MastraMemory instance under this key and
    // hands it to a memory-less sub-agent for one run. The stored value is
    // plain-JSON-shaped, so a request body can reproduce it exactly — and a
    // body-supplied value would be used as the agent's memory and throw on the
    // first memory call.
    expect(isReservedRequestContextKey(MASTRA_INHERITED_MEMORY_KEY)).toBe(true);
  });

  it('leaves ordinary keys to the caller', () => {
    expect(isReservedRequestContextKey('userId')).toBe(false);
  });
});
