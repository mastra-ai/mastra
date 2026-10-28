import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import {
  MASTRA_INHERITED_MEMORY_KEY,
  MASTRA_KNOWLEDGE_SCOPE_KEY,
  MASTRA_SCOPE_ACCESS_KEY,
  MASTRA_SCOPES_KEY,
  RESERVED_REQUEST_CONTEXT_KEYS,
  isReservedRequestContextKey,
} from './constants';
import { mergeBodyRequestContext } from './handlers/utils';

describe('isReservedRequestContextKey', () => {
  it('reserves the inherited-memory key so a request body cannot set it', () => {
    // Agent delegation stores a live MastraMemory instance under this key and
    // hands it to a memory-less sub-agent for one run. The stored value is
    // plain-JSON-shaped, so a request body can reproduce it exactly — and a
    // body-supplied value would be used as the agent's memory and throw on the
    // first memory call.
    expect(isReservedRequestContextKey(MASTRA_INHERITED_MEMORY_KEY)).toBe(true);
  });

  it('reserves the scope-access key so a request body cannot lift a read-only scope', () => {
    expect(isReservedRequestContextKey(MASTRA_SCOPE_ACCESS_KEY)).toBe(true);

    const requestContext = new RequestContext();
    mergeBodyRequestContext(requestContext, { mastra__scopeAccess: { 'org:acme': 'readwrite' }, locale: 'en' });

    expect(requestContext.get(MASTRA_SCOPE_ACCESS_KEY)).toBeUndefined();
    expect(requestContext.get('locale')).toBe('en');
  });

  it('reserves Factory memory settings so a request body cannot spoof the authoritative row', () => {
    expect(isReservedRequestContextKey('mastra__factoryMemorySettings')).toBe(true);

    const requestContext = new RequestContext();
    mergeBodyRequestContext(requestContext, {
      mastra__factoryMemorySettings: { observerModelId: 'openai/spoofed' },
      locale: 'en',
    });

    expect(requestContext.get('mastra__factoryMemorySettings')).toBeUndefined();
    expect(requestContext.get('locale')).toBe('en');
  });

  it('reserves every key in the shared reserved-key list', () => {
    expect(RESERVED_REQUEST_CONTEXT_KEYS).toHaveLength(14);
    expect(new Set(RESERVED_REQUEST_CONTEXT_KEYS).size).toBe(RESERVED_REQUEST_CONTEXT_KEYS.length);
    expect(RESERVED_REQUEST_CONTEXT_KEYS).toEqual(
      expect.arrayContaining([
        MASTRA_SCOPES_KEY,
        MASTRA_KNOWLEDGE_SCOPE_KEY,
        MASTRA_SCOPE_ACCESS_KEY,
        MASTRA_INHERITED_MEMORY_KEY,
        'mastra__factoryMemorySettings',
        'organizationId',
      ]),
    );
    for (const key of RESERVED_REQUEST_CONTEXT_KEYS) {
      expect(isReservedRequestContextKey(key)).toBe(true);
    }
  });

  it('leaves ordinary keys to the caller', () => {
    expect(isReservedRequestContextKey('userId')).toBe(false);
  });
});
