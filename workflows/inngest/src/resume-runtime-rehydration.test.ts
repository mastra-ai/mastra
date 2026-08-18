import { Agent } from '@mastra/core/agent';
import { globalRunRegistry, resolveRuntimeDependencies } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { createInngestAgent } from './index';

function createMockModel() {
  return {
    provider: 'test',
    modelId: 'test-model',
    specificationVersion: 'v1',
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  };
}

describe('InngestAgent resume runtime rehydration', () => {
  it('rebuilds runtime dependencies after the initial stream registry is cleaned up', async () => {
    const inngest = new Inngest({ id: 'resume-runtime-rehydration' });
    const agent = new Agent({
      id: 'resume-runtime-rehydration-agent',
      name: 'Resume Runtime Rehydration Agent',
      instructions: 'Test',
      model: createMockModel() as any,
    });
    const durableAgent = createInngestAgent({ agent, inngest });
    (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue(undefined);
    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-1');
    const initialResult = await durableAgent.stream([{ role: 'user', content: 'hi' }], { requestContext });
    const { runId } = initialResult;

    try {
      await vi.waitFor(() => expect(globalRunRegistry.get(runId)?.workflowExecution).toBeDefined());
      await expect(globalRunRegistry.get(runId)!.workflowExecution).resolves.toBeUndefined();

      const workflowInput = sendSpy.mock.calls[0]?.[0]?.data?.inputData;
      expect(workflowInput?.requestContextEntries).toEqual({ tenantId: 'tenant-1' });

      initialResult.cleanup();
      expect(globalRunRegistry.has(runId)).toBe(false);

      const restoredModel = createMockModel();
      const restoredTools = { approvalTool: { id: 'approval-tool' } as any };
      const assertRestoredContext = (context: RequestContext) => {
        expect(context.get('tenantId')).toBe('tenant-1');
      };
      const registeredAgent = {
        async getToolsForExecution({ requestContext: context }: { requestContext: RequestContext }) {
          assertRestoredContext(context);
          return restoredTools;
        },
        async getModel({ requestContext: context }: { requestContext: RequestContext }) {
          assertRestoredContext(context);
          return restoredModel;
        },
      };
      const snapshot = {
        value: {},
        context: { input: workflowInput },
        suspendedPaths: { 'agentic-loop': ['agentic-loop'] },
      };
      const mastra = {
        getAgentById: () => registeredAgent,
        getStorage: () => ({
          getStore: async () => ({ loadWorkflowSnapshot: async () => snapshot }),
        }),
      };
      (durableAgent as any).__setMastra(mastra);

      const resumedResult = await durableAgent.resume(runId, { approved: true });
      try {
        const placeholder = globalRunRegistry.get(runId);
        expect(placeholder?.isPlaceholder).toBe(true);
        const placeholderAbortController = placeholder?.abortController;
        expect(placeholderAbortController).toBeInstanceOf(AbortController);

        // The durable LLM step performs this resolution on the Inngest worker.
        const resolved = await resolveRuntimeDependencies({
          mastra: mastra as any,
          runId,
          agentId: workflowInput.agentId,
          input: workflowInput,
        });

        expect(resolved.model).toBe(restoredModel);
        expect(resolved.tools).toBe(restoredTools);
        expect(placeholder?.isPlaceholder).toBe(false);
        expect(placeholder?.abortController).toBe(placeholderAbortController);
        await placeholder?.workflowExecution;
      } finally {
        resumedResult.cleanup();
      }
    } finally {
      initialResult.cleanup();
      globalRunRegistry.delete(runId);
      sendSpy.mockRestore();
    }
  });
});
