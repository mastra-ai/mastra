import { describe, expect, it, vi } from 'vitest';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../request-context';
import { runScorer } from './hooks';
import type { ScoringHookInput } from './types';

vi.mock('../hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks')>();
  return {
    ...actual,
    executeHook: vi.fn(),
  };
});

const { executeHook } = await import('../hooks');

function lastPayload(): ScoringHookInput {
  const calls = vi.mocked(executeHook).mock.calls;
  return calls[calls.length - 1]![1] as ScoringHookInput;
}

function baseArgs(requestContext: Record<string, any>) {
  return {
    runId: 'run-1',
    scorerId: 'scorer-1',
    scorerObject: {
      scorer: { id: 'scorer-1', name: 'Scorer', description: 'test scorer' },
    } as any,
    input: {},
    output: {},
    requestContext,
    entity: { id: 'agent-1' },
    structuredOutput: false,
    source: 'LIVE' as const,
    entityType: 'AGENT' as const,
    tracing: undefined,
    loggerVNext: undefined,
    metrics: undefined,
    tracingContext: undefined,
  } as unknown as Parameters<typeof runScorer>[0];
}

describe('runScorer requestContext flattening', () => {
  it('keeps primitive entries, including nested ones', () => {
    runScorer(baseArgs({ userId: 'u1', tenant: { id: 't1' } }));

    expect(lastPayload().requestContext).toEqual({ userId: 'u1', 'tenant.id': 't1' });
  });

  it('excludes the framework-managed auth token from the persisted payload', () => {
    const ctx = new RequestContext([
      ['userId', 'u1'],
      [MASTRA_AUTH_TOKEN_KEY, 'super-secret-bearer-token'],
    ]);

    runScorer(baseArgs(ctx as any));

    const persisted = lastPayload().requestContext;
    expect(persisted).toEqual({ userId: 'u1' });
    expect(JSON.stringify(persisted)).not.toContain('super-secret-bearer-token');
  });
});
