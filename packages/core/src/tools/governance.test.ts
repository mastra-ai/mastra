import { describe, expect, it, vi } from 'vitest';
import { evaluateToolGovernance, recordToolGovernanceResult, ToolGovernanceState } from './governance';
import type { ToolGovernanceAuditEvent, ToolGovernanceOptions, ToolGovernancePolicyContext } from './governance';

const context: ToolGovernancePolicyContext = {
  toolCallId: 'call-1',
  toolName: 'search',
  args: { q: 'docs' },
  runId: 'run-1',
  agentId: 'agent-1',
  resourceId: 'user-1',
  threadId: 'thread-1',
  source: 'agent',
};

describe('tool governance', () => {
  it('evaluates allowlists and denylists deterministically with denylist precedence', async () => {
    const audits: ToolGovernanceAuditEvent[] = [];

    const decision = await evaluateToolGovernance(
      {
        allowlist: ['search'],
        denylist: ['search'],
        onAudit: event => audits.push(event),
      },
      context,
    );

    expect(decision?.allowed).toBe(false);
    expect(decision?.reason).toContain('denied');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      status: 'blocked',
      action: 'deny',
      toolName: 'search',
      runId: 'run-1',
    });
  });

  it('runs custom policies in order and stops on the first denial', async () => {
    const first = vi.fn().mockReturnValue({ allowed: true, metadata: { checked: 'first' } });
    const second = vi.fn().mockReturnValue({ action: 'deny', reason: 'blocked by policy' });
    const third = vi.fn().mockReturnValue(true);

    const decision = await evaluateToolGovernance({ policies: [first, second, third] }, context);

    expect(decision?.allowed).toBe(false);
    expect(decision?.reason).toBe('blocked by policy');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(third).not.toHaveBeenCalled();
  });

  it('tracks cost and blocks execution when a budget would be exceeded', async () => {
    const options: ToolGovernanceOptions = {
      costs: { tools: { search: 2 } },
      budget: { limit: 3, scope: 'agent' },
    };

    const first = await evaluateToolGovernance(options, context);
    const second = await evaluateToolGovernance(options, context);

    expect(first?.allowed).toBe(true);
    expect(first?.budgets?.[0]).toMatchObject({ key: 'agent:agent-1', used: 2, remaining: 1 });
    expect(second?.allowed).toBe(false);
    expect(second?.reason).toContain('budget exceeded');
    expect(second?.budgets?.[0]).toMatchObject({ key: 'agent:agent-1', used: 4, remaining: -1 });
  });

  it('opens a circuit breaker after repeated failures', async () => {
    const state = new ToolGovernanceState();
    const options: ToolGovernanceOptions = {
      state,
      circuitBreaker: { failureThreshold: 2, scope: 'tool' },
    };

    const first = await evaluateToolGovernance(options, context);
    await recordToolGovernanceResult({
      options,
      context,
      evaluation: first,
      status: 'failed',
      error: new Error('first failure'),
    });

    const second = await evaluateToolGovernance(options, context);
    await recordToolGovernanceResult({
      options,
      context,
      evaluation: second,
      status: 'failed',
      error: new Error('second failure'),
    });

    const third = await evaluateToolGovernance(options, context);

    expect(third?.allowed).toBe(false);
    expect(third?.reason).toContain('Circuit breaker is open');
    expect(third?.circuitBreaker).toMatchObject({ key: 'tool:search', failures: 2 });
  });

  it('records structured audit events for success and failure without throwing on audit errors', async () => {
    const audits: ToolGovernanceAuditEvent[] = [];
    const logger = { info: vi.fn(), warn: vi.fn() } as any;
    const options: ToolGovernanceOptions = {
      costs: { default: 1 },
      onAudit: event => {
        audits.push(event);
        if (event.status === 'completed') {
          throw new Error('audit sink unavailable');
        }
      },
    };

    const evaluation = await evaluateToolGovernance(options, context, logger);
    await recordToolGovernanceResult({ options, context, evaluation, status: 'completed', logger });

    expect(audits.map(event => event.status)).toEqual(['allowed', 'completed']);
    expect(audits[0]).toMatchObject({
      action: 'allow',
      estimatedCost: 1,
      agentId: 'agent-1',
      resourceId: 'user-1',
      threadId: 'thread-1',
    });
    expect(logger.warn).toHaveBeenCalledWith('[ToolGovernance] audit callback failed', expect.any(Error));
  });
});
