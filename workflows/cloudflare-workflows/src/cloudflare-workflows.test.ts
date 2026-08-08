import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { executeCloudflareWorkflowAgentStep } from './entrypoint';
import { CloudflareWorkflowExecutionEngine } from './execution-engine';
import type {
  CloudflareWorkflowBinding,
  CloudflareWorkflowInstance,
  CloudflareWorkflowStep,
  CloudflareWorkflowStepExecutor,
} from './types';
import { runCloudflareWorkflowAgent } from './worker';

describe('runCloudflareWorkflowAgent', () => {
  it('runs settled segments with stable keys and waits for native resume events', async () => {
    const execute = vi
      .fn<CloudflareWorkflowStepExecutor['execute']>()
      .mockResolvedValueOnce({ status: 'suspended' })
      .mockResolvedValueOnce({ status: 'success', output: { text: 'complete' } });
    const step: CloudflareWorkflowStep = {
      do: vi.fn(async (_name, _config, callback) => callback()),
      waitForEvent: vi.fn(async () => ({
        type: 'mastra-resume',
        timestamp: new Date(),
        payload: { resumeData: { answer: 'yes' }, label: 'question-1' },
      })),
    };

    const result = await runCloudflareWorkflowAgent({
      event: {
        instanceId: 'run-1',
        payload: {
          runId: 'run-1',
          input: { agentId: 'agent-1' } as never,
        },
      },
      step,
      executor: { execute },
    });

    expect(result).toEqual({ status: 'success', output: { text: 'complete' } });
    expect(step.do).toHaveBeenNthCalledWith(1, 'run-1:start', expect.any(Object), expect.any(Function));
    expect(step.do).toHaveBeenNthCalledWith(2, 'run-1:resume:1', expect.any(Object), expect.any(Function));
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'start',
        idempotencyKey: 'run-1:start',
      }),
    );
    expect(execute).toHaveBeenNthCalledWith(2, {
      operation: 'resume',
      runId: 'run-1',
      idempotencyKey: 'run-1:resume:1',
      resumeData: { answer: 'yes' },
      label: 'question-1',
    });
  });

  it('carries serialized request context and actor through start and resume', async () => {
    const status = vi.fn(async () => ({ status: 'running' as const }));
    const sendEvent = vi.fn(async () => undefined);
    const instance = {
      id: 'run-1',
      status,
      sendEvent,
    } as unknown as CloudflareWorkflowInstance;
    const binding = {
      create: vi.fn(async () => instance),
      get: vi.fn(async () => instance),
    } as unknown as CloudflareWorkflowBinding;
    const engine = new CloudflareWorkflowExecutionEngine({ workflow: binding });
    const requestContext = new RequestContext([['tenantId', 'tenant-1']]);
    const actor = { actorKind: 'system' as const, agentId: 'agent-1' };
    const context = {
      workflow: {} as any,
      runId: 'run-1',
      pubsub: {} as any,
      requestContext,
      actor,
    };

    await engine.start({ ...context, input: { agentId: 'agent-1' } as never });
    await engine.resume({ ...context, resumeData: { approved: true }, label: 'approval-1' });

    expect(binding.create).toHaveBeenCalledWith({
      id: 'run-1',
      params: {
        runId: 'run-1',
        input: { agentId: 'agent-1' },
        requestContext: { tenantId: 'tenant-1' },
        actor,
      },
    });
    expect(sendEvent).toHaveBeenCalledWith({
      type: 'mastra-resume',
      payload: {
        resumeData: { approved: true },
        label: 'approval-1',
        requestContext: { tenantId: 'tenant-1' },
        actor,
      },
    });
  });

  it('rehydrates request context and actor before invoking the Mastra workflow run', async () => {
    const start = vi.fn(async () => ({ status: 'success' as const, result: { ok: true } }));
    const workflow = {
      createRun: vi.fn(async () => ({ start })),
    } as any;
    const actor = { actorKind: 'system' as const, sourceWorkflow: 'cloudflare' };

    await executeCloudflareWorkflowAgentStep({
      workflow,
      pubsub: {} as any,
      request: {
        operation: 'start',
        runId: 'run-1',
        idempotencyKey: 'run-1:start',
        input: { agentId: 'agent-1' } as never,
        requestContext: { tenantId: 'tenant-1' },
        actor,
      },
    });

    const call = start.mock.calls[0]?.[0];
    expect(call?.requestContext).toBeInstanceOf(RequestContext);
    expect(call?.requestContext.get('tenantId')).toBe('tenant-1');
    expect(call?.actor).toEqual(actor);
  });
});
