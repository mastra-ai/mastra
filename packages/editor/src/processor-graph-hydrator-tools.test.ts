import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MessageList } from '@mastra/core/agent';
import type { ProcessorWorkflow } from '@mastra/core/processors';
import type { ProcessorProvider } from '@mastra/core/processor-provider';
import type { ProcessorGraphEntry, StoredProcessorGraph } from '@mastra/core/storage';

import { hydrateProcessorGraph } from './processor-graph-hydrator';

function step(id: string): Extract<ProcessorGraphEntry, { type: 'step' }> {
  return {
    type: 'step',
    step: { id, providerId: 'passthrough', config: {}, enabledPhases: ['processInputStep'] },
  };
}

const provider: ProcessorProvider = {
  info: { id: 'passthrough', name: 'Passthrough' },
  configSchema: z.object({}),
  availablePhases: ['processInputStep'],
  createProcessor: () => ({ id: 'passthrough', processInputStep: () => undefined }),
};

describe('processor graph branch outputs', () => {
  it.each(['parallel', 'conditional'] as const)('preserves model tool settings after a %s join', async kind => {
    const entry: ProcessorGraphEntry =
      kind === 'parallel'
        ? { type: 'parallel', branches: [[step('first')], [step('second')]] }
        : {
            type: 'conditional',
            conditions: [
              {
                rules: {
                  operator: 'AND',
                  conditions: [{ field: 'phase', operator: 'equals', value: 'inputStep' }],
                },
                steps: [step('first')],
              },
            ],
          };
    const graph: StoredProcessorGraph = { steps: [entry] };
    const [workflow] = hydrateProcessorGraph(graph, 'input', { providers: { passthrough: provider } })!;
    const messages = [
      {
        id: 'message-1',
        role: 'user' as const,
        createdAt: new Date(0),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Find evidence' }] },
      },
    ];
    const messageList = new MessageList();
    messageList.add(messages, 'input');
    const tools = { retrieveKb: { description: 'Search the knowledge base' } };

    const run = await (workflow as ProcessorWorkflow).createRun();
    const result = await run.start({
      inputData: {
        phase: 'inputStep',
        stepNumber: 0,
        messages,
        messageList,
        tools,
        activeTools: ['retrieveKb'],
        toolChoice: 'required',
      },
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error(`Workflow failed: ${result.status}`);
    expect(result.result.tools).toEqual(tools);
    expect(result.result.activeTools).toEqual(['retrieveKb']);
    expect(result.result.toolChoice).toBe('required');
  });
});
