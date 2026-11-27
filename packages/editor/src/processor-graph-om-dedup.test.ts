import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { ProcessorPhase, ProcessorProvider } from '@mastra/core/processor-provider';
import type { InputProcessorOrWorkflow, Processor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import type { ProcessorGraphEntry, StoredProcessorGraph } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { hydrateProcessorGraph } from './processor-graph-hydrator';

const textModel = (t: string) =>
  new MockLanguageModelV2({
    doStream: async () => ({
      stream: new ReadableStream({
        start(c) {
          c.enqueue({ type: 'stream-start', warnings: [] });
          c.enqueue({ type: 'text-start', id: 't' });
          c.enqueue({ type: 'text-delta', id: 't', delta: t });
          c.enqueue({ type: 'text-end', id: 't' });
          c.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          c.close();
        },
      }),
    }),
  });

function createMemory() {
  return new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        model: textModel('<observations>\n- x\n</observations>'),
        scope: 'thread',
        observation: { bufferTokens: false, messageTokens: 100_000 },
      },
    },
  });
}

function provider(id: string, create: () => Processor, phases: ProcessorPhase[]): ProcessorProvider {
  return {
    info: { id, name: id },
    configSchema: z.object({}),
    availablePhases: phases,
    createProcessor: create,
  };
}

const otherProcessor: Processor = { id: 'other', processInput: async ({ messages }) => messages };

// Graph step ids are editor-generated and never the processor's own id.
const omStep = (enabledPhases: ProcessorPhase[]): ProcessorGraphEntry => ({
  type: 'step',
  step: { id: 'step-a1b2c3', providerId: 'om', config: {}, enabledPhases },
});
const otherStep = {
  type: 'step' as const,
  step: { id: 'step-d4e5f6', providerId: 'other', config: {}, enabledPhases: ['processInput'] as ProcessorPhase[] },
};

const graphs: Record<string, (phases: ProcessorPhase[]) => StoredProcessorGraph> = {
  conditional: phases => ({
    steps: [
      {
        type: 'conditional',
        conditions: [
          {
            rules: { operator: 'AND', conditions: [{ field: 'phase', operator: 'equals', value: 'input' }] },
            steps: [omStep(phases) as any],
          },
          { steps: [otherStep] },
        ],
      },
    ],
  }),
  parallel: phases => ({ steps: [{ type: 'parallel', branches: [[omStep(phases) as any], [otherStep]] }] }),
  'nested parallel inside conditional': phases => ({
    steps: [
      {
        type: 'conditional',
        conditions: [{ steps: [{ type: 'parallel', branches: [[omStep(phases) as any], [otherStep]] }] }],
      },
    ],
  }),
};

describe('Memory does not add a second OM processor when an Editor processor graph already has one', () => {
  for (const [name, build] of Object.entries(graphs)) {
    for (const [label, phases] of [
      ['all phases', undefined],
      ['phase-filtered', ['processInputStep']],
    ] as const) {
      it(`${name} graph (${label}): Memory adds no OM processor of its own`, async () => {
        const memory = createMemory();
        const [om] = await memory.getInputProcessors([]).then(ps => ps.filter(p => p.id === 'observational-memory'));
        expect(om).toBeDefined();
        const omPhases = (['processInputStep', 'processOutputResult'] as ProcessorPhase[]).filter(
          p => typeof (om as any)[p] === 'function',
        );

        const hydrated = hydrateProcessorGraph(build(phases ? [...phases] : omPhases), 'input', {
          providers: {
            om: provider('om', () => om as Processor, omPhases),
            other: provider('other', () => otherProcessor, ['processInput']),
          },
        }) as InputProcessorOrWorkflow[];
        expect(hydrated).toHaveLength(1);

        const input = await memory.getInputProcessors(hydrated);
        expect(input.map(p => p.id)).not.toContain('observational-memory');
      });
    }
  }
});
