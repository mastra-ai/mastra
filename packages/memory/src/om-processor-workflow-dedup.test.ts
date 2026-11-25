import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { ProcessorStepSchema } from '@mastra/core/processors';
import type { ProcessorWorkflow } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { cloneStep, createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemoryProcessor } from './processors/observational-memory';
import { Memory } from './index';

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

function processorWorkflow(id: string) {
  return createWorkflow({
    id,
    type: 'processor',
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
    options: { validateInputs: false },
  });
}

const passthrough = (id: string) =>
  createStep({
    id: `processor:${id}`,
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
    execute: async ({ inputData }) => inputData,
  });

type GraphBuilder = (om: ObservationalMemoryProcessor) => ProcessorWorkflow;

const graphs: Record<string, GraphBuilder> = {
  sequential: om => processorWorkflow('sequential').then(createStep(om)).commit() as ProcessorWorkflow,
  branched: om =>
    processorWorkflow('branched')
      .branch([
        [async () => true, createStep(om)],
        [async () => false, passthrough('other')],
      ])
      .commit() as ProcessorWorkflow,
  parallel: om =>
    processorWorkflow('parallel')
      .parallel([createStep(om), passthrough('other')])
      .commit() as ProcessorWorkflow,
  loop: om =>
    processorWorkflow('loop')
      .dountil(createStep(om), async () => true)
      .commit() as ProcessorWorkflow,
  foreach: om =>
    processorWorkflow('foreach')
      .map(async ({ inputData }) => [inputData])
      .foreach(createStep(om))
      .map(async ({ inputData }) => inputData[0])
      .commit() as ProcessorWorkflow,
  'after sleep': om => processorWorkflow('after-sleep').sleep(1).then(createStep(om)).commit() as ProcessorWorkflow,
  'renamed with cloneStep': om =>
    processorWorkflow('cloned')
      .then(cloneStep(createStep(om), { id: 'my-om-step' }))
      .commit() as ProcessorWorkflow,
  nested: om =>
    processorWorkflow('outer')
      .then(processorWorkflow('inner').then(createStep(om)).commit())
      .commit() as ProcessorWorkflow,
};

describe('Memory does not add a second Observational Memory processor when one is inside a processor workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const [name, build] of Object.entries(graphs)) {
    it(`${name} processor workflow: Memory adds no OM processor of its own`, async () => {
      const memory = createMemory();
      const om = new ObservationalMemoryProcessor((await memory.omEngine)!, memory);
      const graph = build(om);

      const input = await memory.getInputProcessors([graph]);
      const output = await memory.getOutputProcessors([graph]);
      const error = await memory.getErrorProcessors([graph]);

      expect(input.map(p => p.id)).not.toContain('observational-memory');
      expect(output.map(p => p.id)).not.toContain('observational-memory');
      expect(error.map(p => p.id)).not.toContain('observational-memory');
    });
  }

  it('still adds its OM processor when the workflow has no OM step', async () => {
    const memory = createMemory();
    const graph = processorWorkflow('no-om').then(passthrough('other')).commit() as ProcessorWorkflow;

    const input = await memory.getInputProcessors([graph]);
    expect(input.map(p => p.id)).toContain('observational-memory');
  });

  it('an agent whose OM processor is inside a processor workflow runs exactly one OM processor', async () => {
    const memory = createMemory();
    const instances = new Set<object>();
    const original = ObservationalMemoryProcessor.prototype.processInputStep;
    vi.spyOn(ObservationalMemoryProcessor.prototype, 'processInputStep').mockImplementation(
      function (this: ObservationalMemoryProcessor, args) {
        instances.add(this);
        return original.call(this, args);
      },
    );

    const om = new ObservationalMemoryProcessor((await memory.omEngine)!, memory);
    const agent = new Agent({
      id: 'om-workflow-agent',
      name: 'om-workflow-agent',
      instructions: 'help',
      model: textModel('ok'),
      memory,
      inputProcessors: [graphs.sequential(om)],
    });

    await (await agent.stream('hi', { memory: { thread: 't1', resource: 'r1' } })).consumeStream();

    expect([...instances]).toEqual([om]);
  });
});
