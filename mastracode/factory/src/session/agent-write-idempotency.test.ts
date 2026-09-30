import { describe, expect, it } from 'vitest';

import { agentToolCallIdForWrite, factoryGithubIdempotencyKey } from './agent-write-idempotency.js';

const context = {
  orgId: 'org-1',
  factoryProjectId: 'factory-1',
  projectRepositoryId: 'repo-link-1',
  repositoryId: 'repo-external-1',
  threadId: 'thread-1',
  operation: 'create-pull-request',
  operationId: 'tool-call-1',
};

describe('factoryGithubIdempotencyKey', () => {
  it('is stable for the same trusted operation address', () => {
    expect(factoryGithubIdempotencyKey(context)).toBe(factoryGithubIdempotencyKey({ ...context }));
    expect(factoryGithubIdempotencyKey(context)).toMatch(/^factory-github:v1:[a-f0-9]{64}$/);
  });

  it('separates tenants, projects, stable repository IDs, threads, operations, and tool calls', () => {
    const key = factoryGithubIdempotencyKey(context);
    for (const field of Object.keys(context) as (keyof typeof context)[]) {
      expect(factoryGithubIdempotencyKey({ ...context, [field]: `${context[field]}-other` })).not.toBe(key);
    }
  });
});

describe('agentToolCallIdForWrite', () => {
  it('requires a call ID when executing in an agent context and allows direct invocations', () => {
    expect(agentToolCallIdForWrite({})).toBeUndefined();
    expect(agentToolCallIdForWrite({ agent: { toolCallId: 'call-1' } })).toBe('call-1');
    expect(() => agentToolCallIdForWrite({ agent: { toolCallId: '' } })).toThrow(/tool call ID/);
  });
});
