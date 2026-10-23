import { describe, expect, it } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_SCOPES_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../request-context';
import { deriveAgentRunRequestContext, resolveAgentScopes, withoutIdentityAgentScopes } from '../scopes';

function contextWith(entries: Record<string, unknown>) {
  return new RequestContext(Object.entries(entries));
}

function conflict(fn: () => unknown) {
  try {
    fn();
  } catch (error: any) {
    return { id: error.id, status: error.details?.status, message: String(error.message) };
  }
  throw new Error('expected resolveAgentScopes to throw');
}

describe('resolveAgentScopes', () => {
  describe('union', () => {
    it('unions reserved key, Agent config and call scopes, de-duped in source order', () => {
      const result = resolveAgentScopes({
        requestContext: contextWith({ [MASTRA_SCOPES_KEY]: ['org:acme', 'team:core'] }),
        agentScopes: ['team:core', 'region:eu'],
        callScopes: ['org:acme', 'project:p1'],
      });
      expect(result.scopes).toEqual(['org:acme', 'team:core', 'region:eu', 'project:p1']);
    });

    it('accepts arbitrary scope types and resource/thread-only sets', () => {
      const result = resolveAgentScopes({ callScopes: ['resource:u1', 'thread:t1', 'x-custom_1:v:with:colons'] });
      expect(result).toEqual({
        scopes: ['resource:u1', 'thread:t1', 'x-custom_1:v:with:colons'],
        resourceId: 'u1',
        threadId: 't1',
      });
    });
  });

  describe('validation', () => {
    it.each([
      ['missing colon', 'acme'],
      ['empty type', ':acme'],
      ['empty value', 'org:'],
      ['uppercase type', 'Org:acme'],
      ['type starting with a digit', '1org:acme'],
      ['nested thread inside resource', 'resource:u1:thread:t1'],
      ['nested thread inside thread', 'thread:u1:thread:t1'],
    ])('rejects %s', (_label, scope) => {
      const error = conflict(() => resolveAgentScopes({ callScopes: [scope] }));
      expect(error).toMatchObject({ id: 'AGENT_SCOPES_INVALID', status: 400 });
      expect(error.message).toContain(scope);
    });

    it('rejects a non-array reserved key and non-string entries', () => {
      expect(
        conflict(() => resolveAgentScopes({ requestContext: contextWith({ [MASTRA_SCOPES_KEY]: 'org:acme' }) })),
      ).toMatchObject({ id: 'AGENT_SCOPES_INVALID', status: 400 });
      expect(conflict(() => resolveAgentScopes({ callScopes: [42 as unknown as string] }))).toMatchObject({
        id: 'AGENT_SCOPES_INVALID',
      });
    });
  });

  describe('identity conflicts', () => {
    it('throws on two distinct resource or thread scopes', () => {
      expect(conflict(() => resolveAgentScopes({ callScopes: ['resource:a', 'resource:b'] }))).toMatchObject({
        id: 'AGENT_SCOPES_CONFLICT',
        status: 400,
      });
      expect(
        conflict(() =>
          resolveAgentScopes({
            agentScopes: ['thread:a'],
            requestContext: contextWith({ [MASTRA_SCOPES_KEY]: ['thread:b'] }),
          }),
        ),
      ).toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    });

    it.each([
      ['memory.resource', { memory: { resource: 'other', thread: 't1' } }],
      ['resourceId', { resourceId: 'other' }],
      ['reserved resource key', { requestContext: contextWith({ [MASTRA_RESOURCE_ID_KEY]: 'other' }) }],
      ['snapshot resource', { snapshot: { resourceId: 'other' } }],
    ])('throws when the resource scope conflicts with %s', (_label, input) => {
      expect(conflict(() => resolveAgentScopes({ callScopes: ['resource:u1'], ...input }))).toMatchObject({
        id: 'AGENT_SCOPES_CONFLICT',
        status: 400,
      });
    });

    it.each([
      ['memory.thread string', { memory: { thread: 'other' } }],
      ['memory.thread object', { memory: { thread: { id: 'other' } } }],
      ['threadId', { threadId: 'other' }],
      ['reserved thread key', { requestContext: contextWith({ [MASTRA_THREAD_ID_KEY]: 'other' }) }],
      ['snapshot thread', { snapshot: { threadId: 'other' } }],
    ])('throws when the thread scope conflicts with %s', (_label, input) => {
      expect(conflict(() => resolveAgentScopes({ callScopes: ['thread:t1'], ...input }))).toMatchObject({
        id: 'AGENT_SCOPES_CONFLICT',
        status: 400,
      });
    });

    it('does not throw when every source agrees', () => {
      const result = resolveAgentScopes({
        requestContext: contextWith({
          [MASTRA_SCOPES_KEY]: ['resource:u1'],
          [MASTRA_RESOURCE_ID_KEY]: 'u1',
          [MASTRA_THREAD_ID_KEY]: 't1',
        }),
        callScopes: ['thread:t1'],
        memory: { resource: 'u1', thread: { id: 't1' } },
        resourceId: 'u1',
        threadId: 't1',
        snapshot: { resourceId: 'u1', threadId: 't1' },
      });
      expect(result).toEqual({ scopes: ['resource:u1', 'thread:t1'], resourceId: 'u1', threadId: 't1' });
    });
  });

  describe('per-field resolution', () => {
    it('leaves thread on the existing precedence when scopes carry only a resource', () => {
      const result = resolveAgentScopes({
        callScopes: ['resource:u1'],
        requestContext: contextWith({ [MASTRA_THREAD_ID_KEY]: 'from-context' }),
        memory: { thread: 'from-memory' },
      });
      expect(result).toMatchObject({ resourceId: 'u1', threadId: 'from-context' });
    });

    it('leaves resource on the existing precedence when scopes carry only a thread', () => {
      const result = resolveAgentScopes({
        callScopes: ['thread:t1'],
        requestContext: contextWith({ [MASTRA_RESOURCE_ID_KEY]: 'from-context' }),
        memory: { resource: 'from-memory' },
      });
      expect(result).toMatchObject({ resourceId: 'from-context', threadId: 't1' });
    });
  });

  describe('without scopes', () => {
    it('keeps the existing precedence: reserved key, then options, then memory, then snapshot', () => {
      const all = {
        requestContext: contextWith({ [MASTRA_RESOURCE_ID_KEY]: 'ctx-r', [MASTRA_THREAD_ID_KEY]: 'ctx-t' }),
        memory: { resource: 'mem-r', thread: 'mem-t' },
        resourceId: 'opt-r',
        threadId: 'opt-t',
        snapshot: { resourceId: 'snap-r', threadId: 'snap-t' },
      };
      expect(resolveAgentScopes(all)).toEqual({ scopes: [], resourceId: 'ctx-r', threadId: 'ctx-t' });
      expect(resolveAgentScopes({ ...all, requestContext: undefined })).toEqual({
        scopes: [],
        resourceId: 'opt-r',
        threadId: 'mem-t',
      });
      expect(resolveAgentScopes({ memory: { resource: 'mem-r' }, threadId: 'opt-t', snapshot: all.snapshot })).toEqual({
        scopes: [],
        resourceId: 'mem-r',
        threadId: 'opt-t',
      });
      expect(resolveAgentScopes({ snapshot: all.snapshot })).toEqual({
        scopes: [],
        resourceId: 'snap-r',
        threadId: 'snap-t',
      });
    });

    it('does not throw when legacy sources disagree with each other', () => {
      const result = resolveAgentScopes({
        requestContext: contextWith({ [MASTRA_RESOURCE_ID_KEY]: 'ctx-r' }),
        memory: { resource: 'mem-r' },
        callScopes: ['org:acme'],
      });
      expect(result).toEqual({ scopes: ['org:acme'], resourceId: 'ctx-r', threadId: undefined });
    });
  });

  describe('resume', () => {
    const snapshot = { resourceId: 'u1', threadId: 't1', scopes: ['org:a', 'resource:u1', 'thread:t1', 'team:core'] };

    it('uses the snapshot set when nothing is re-supplied', () => {
      expect(resolveAgentScopes({ snapshot })).toEqual({ scopes: snapshot.scopes, resourceId: 'u1', threadId: 't1' });
    });

    it('accepts a re-supplied subset and keeps the full snapshot set', () => {
      const result = resolveAgentScopes({
        snapshot,
        requestContext: contextWith({ [MASTRA_SCOPES_KEY]: ['org:a'] }),
      });
      expect(result.scopes).toEqual(snapshot.scopes);
    });

    it('throws when a re-supplied scope is not in the snapshot', () => {
      expect(conflict(() => resolveAgentScopes({ snapshot, callScopes: ['org:b'] }))).toMatchObject({
        id: 'AGENT_SCOPES_CONFLICT',
        status: 400,
      });
      expect(
        conflict(() =>
          resolveAgentScopes({ snapshot, requestContext: contextWith({ [MASTRA_SCOPES_KEY]: ['thread:t2'] }) }),
        ),
      ).toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    });

    it('keeps the snapshot set when the Agent configuration now returns other scopes', () => {
      expect(resolveAgentScopes({ snapshot, agentScopes: ['org:b', 'thread:t2'] })).toEqual({
        scopes: snapshot.scopes,
        resourceId: 'u1',
        threadId: 't1',
      });
      expect(resolveAgentScopes({ snapshot: { scopes: [] }, agentScopes: ['org:local'] }).scopes).toEqual([]);
      expect(conflict(() => resolveAgentScopes({ snapshot, agentScopes: ['Org:bad'] }))).toMatchObject({
        id: 'AGENT_SCOPES_INVALID',
      });
    });

    it('throws when a resumed run is given a different memory thread', () => {
      expect(conflict(() => resolveAgentScopes({ snapshot, memory: { thread: 't2' } }))).toMatchObject({
        id: 'AGENT_SCOPES_CONFLICT',
      });
    });
  });
});

describe('deriveAgentRunRequestContext', () => {
  it('returns the caller context unchanged when the run has no scopes', () => {
    const context = contextWith({ a: 1 });
    expect(deriveAgentRunRequestContext(context, [])).toBe(context);
  });

  it('copies the caller context, keeps only non-identity scopes, and never mutates the caller', () => {
    const callerScopes = ['org:acme', 'resource:u1', 'thread:t1'];
    const context = contextWith({ a: 1, [MASTRA_SCOPES_KEY]: callerScopes });
    const derived = deriveAgentRunRequestContext(context, [...callerScopes, 'team:core']);

    expect(derived).not.toBe(context);
    expect(derived.get('a')).toBe(1);
    expect(derived.get(MASTRA_SCOPES_KEY)).toEqual(['org:acme', 'team:core']);
    expect(context.get(MASTRA_SCOPES_KEY)).toBe(callerScopes);
    expect(callerScopes).toEqual(['org:acme', 'resource:u1', 'thread:t1']);

    derived.set('b', 2);
    expect(context.has('b')).toBe(false);
  });

  it('drops the reserved key when only identity scopes remain', () => {
    const context = contextWith({ [MASTRA_SCOPES_KEY]: ['resource:u1', 'thread:t1'] });
    const derived = deriveAgentRunRequestContext(context, ['resource:u1', 'thread:t1']);
    expect(derived.has(MASTRA_SCOPES_KEY)).toBe(false);
    expect(context.has(MASTRA_SCOPES_KEY)).toBe(true);
  });

  it('lets a nested call on the derived context choose its own thread without conflict', () => {
    const parent = resolveAgentScopes({ callScopes: ['org:acme', 'resource:u1', 'thread:t1'] });
    const derived = deriveAgentRunRequestContext(new RequestContext(), parent.scopes);
    derived.set(MASTRA_THREAD_ID_KEY, 't1-observer');
    const nested = resolveAgentScopes({ requestContext: derived, memory: { thread: 'other', resource: 'u2' } });
    expect(nested).toEqual({ scopes: ['org:acme'], resourceId: 'u2', threadId: 't1-observer' });
  });
});

describe('withoutIdentityAgentScopes', () => {
  it('removes only resource and thread scopes', () => {
    expect(withoutIdentityAgentScopes(['org:a', 'resource:u', 'thread:t', 'resourcex:y', 'team:core'])).toEqual([
      'org:a',
      'resourcex:y',
      'team:core',
    ]);
  });
});
