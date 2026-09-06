import { getEventListeners } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createStep, createWorkflow } from '../../workflows';
import { createNetworkLoop } from './index';

describe('network workflow cancellation ownership', () => {
  it.each(['complete', 'abort', 'write failure'] as const)(
    '%s observes cancellation and removes its listener',
    async mode => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External network forbidden'));
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      await memory.saveThread({
        thread: { id: 'thread', resourceId: 'resource', title: 'Local', createdAt: new Date(), updatedAt: new Date() },
      });
      const signal = new AbortController();
      const entered = Promise.withResolvers<void>();
      const child = createWorkflow({ id: 'child', inputSchema: z.object({}), outputSchema: z.object({}) })
        .then(
          createStep({
            id: 'local',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute: async ({ abortSignal }) => {
              entered.resolve();
              if (mode !== 'complete')
                await new Promise<void>(resolve =>
                  abortSignal.addEventListener('abort', () => resolve(), { once: true }),
                );
              return {};
            },
          }),
        )
        .commit();
      const model = new MastraLanguageModelV2Mock({
        doStream: async () => {
          throw new Error('No model should run');
        },
      });
      const agent = new Agent({
        id: 'network-owner',
        name: 'Owner',
        instructions: 'Use child.',
        model,
        memory,
        workflows: { child },
      });
      const mastra = new Mastra({
        agents: { agent },
        workflows: { child },
        storage,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
      });
      const requestContext = new RequestContext();
      const { networkWorkflow } = await createNetworkLoop({
        networkName: 'local-network',
        requestContext,
        runId: 'local-network-run',
        agent,
        generateId: () => 'local-id',
        abortSignal: signal.signal,
      });
      const step = networkWorkflow.steps['workflow-execution-step'];
      const failure = new Error('Cancellation storage unavailable');
      const workflows = (await storage.getStore('workflows'))!;
      let write: ReturnType<typeof vi.spyOn> | undefined;
      const execution = step.execute!({
        inputData: {
          task: 'Local',
          primitiveType: 'workflow',
          primitiveId: 'child',
          prompt: '{}',
          selectionReason: 'Local',
          iteration: 1,
        },
        requestContext,
        mastra,
        writer: { write: async () => {} },
        getInitData: () => ({ threadId: 'thread', threadResourceId: 'resource' }),
      } as any);
      try {
        await entered.promise;
        if (mode === 'write failure') write = vi.spyOn(workflows, 'updateWorkflowState').mockRejectedValueOnce(failure);
        const result = Promise.resolve(execution);
        if (mode !== 'complete') signal.abort();
        if (mode === 'write failure') await expect(result).rejects.toBe(failure);
        else await expect(result).resolves.toBeDefined();
        expect(getEventListeners(signal.signal, 'abort')).toHaveLength(0);
        expect(network).not.toHaveBeenCalled();
      } finally {
        write?.mockRestore();
        network.mockRestore();
      }
    },
  );
});
