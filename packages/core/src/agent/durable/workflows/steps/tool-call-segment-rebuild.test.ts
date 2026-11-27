import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../../mastra';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { Agent } from '../../../agent';
import { DURABLE_CONTEXT_SEGMENT_KEY, globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const runId = 'segment-rebuild';

afterEach(() => {
  globalRunRegistry.delete(runId);
});

describe('durable tool call in a newer run segment', () => {
  it.each(['the step that rebuilt them', 'a later step in the same segment'] as const)(
    'sees the delegation bail flag set by a tool rebuilt for the segment, in %s',
    async when => {
      const built: unknown[] = [];
      const agent = new Agent({
        id: 'delegator',
        name: 'delegator',
        instructions: 'Delegate.',
        model: 'openai/gpt-4o-mini',
        tools: ({ requestContext }) => {
          built.push((requestContext.get('mastra__user') as { id?: string } | undefined)?.id);
          return {
            lookup: createTool({
              id: 'lookup',
              description: 'Does not bail',
              inputSchema: z.object({}),
              execute: async () => ({ ok: true }),
            }),
            delegate: createTool({
              id: 'delegate',
              description: 'Bails out of the delegation',
              inputSchema: z.object({}),
              execute: async () => {
                requestContext.set('__mastra_delegationBailed', true);
                return { ok: true };
              },
            }),
          };
        },
      });
      const mastra = new Mastra({ agents: { delegator: agent }, logger: false });
      const staleExecute = vi.fn();
      globalRunRegistry.set(runId, {
        tools: {
          lookup: { id: 'lookup', execute: staleExecute },
          delegate: { id: 'delegate', execute: staleExecute },
        },
        model: { modelId: 'gpt-4o-mini', provider: 'openai' },
        toolsSegment: 'segment-1',
        // What a hydrated entry has, so the step's cross-process fallback rebuild stays out of it.
        saveQueueManager: { flushMessages: vi.fn().mockResolvedValue(undefined) },
        outputProcessors: [],
        processorStates: new Map(),
      } as any);

      // Each step gets its own request context, as the evented engine rehydrates one per step.
      const runStep = (toolName: string, toolCallId: string) =>
        (createDurableToolCallStep() as any).execute({
          getState: async () => ({}),
          inputData: { toolCallId, toolName, args: {} },
          suspend: vi.fn(),
          requestContext: new RequestContext([
            ['mastra__user', { id: 'resumer' }],
            [DURABLE_CONTEXT_SEGMENT_KEY, 'segment-2'],
          ]),
          getInitData: () => ({
            runId,
            agentId: 'delegator',
            options: {},
            // The snapshot from the starting request, so the rebuild gets a context of its own.
            requestContextEntries: { tenant: 'acme', mastra__user: { id: 'starter' } },
            state: { threadId: 'thread-1', resourceId: 'user-1' },
          }),
          mastra,
          [PUBSUB_SYMBOL]: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() },
        });

      if (when === 'a later step in the same segment') {
        const first = await runStep('lookup', 'call-1');
        expect(first.error).toBeUndefined();
        expect(first.delegationBailed).toBeUndefined();
      }
      const result = await runStep('delegate', 'call-2');

      expect(staleExecute).not.toHaveBeenCalled();
      expect(built).toEqual(['resumer']);
      expect(result.error).toBeUndefined();
      expect(result.delegationBailed).toBe(true);
    },
  );
});
