import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InternalSpans, SpanType, TracingEventType } from '../../../../observability';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

describeForAllEngines('run and generation span fields', engine => {
  const getMock = useLoopScenarioAimock();

  it('records the prompt, settings, tools and object', async () => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Pick a color.',
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up a color.',
          inputSchema: z.object({ n: z.number() }),
          execute: async () => ({ color: 'blue' }),
        }),
      },
      structuredOutput: { schema: z.object({ word: z.string() }) },
      modelSettings: { temperature: 0 },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { n: 1 } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: '{"word":"Blue"}' });
      },
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
    });

    const [run] = ended();
    const [generation] = ended(SpanType.MODEL_GENERATION);
    expect(run!.attributes).toMatchObject({ availableTools: ['lookup'] });
    expect(run!.output).toMatchObject({ object: { word: 'Blue' } });
    expect(generation!.input).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
    });
    expect(generation!.attributes).toMatchObject({
      parameters: { temperature: 0 },
      tools: [expect.objectContaining({ name: 'lookup' })],
    });
    expect(generation!.output).toMatchObject({ object: { word: 'Blue' } });
  });

  it('records an input processor abort on the run', async () => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Hello.',
      inputProcessors: [{ id: 'block', processInput: ({ abort }) => abort('blocked by test') }],
      fixtures: llm => llm.onMessage(/.*/, { content: 'The model should never run.' }),
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
    });

    const tripwire = { reason: 'blocked by test', processorId: 'block' };
    const [run] = ended();
    expect(run!.output).toMatchObject({ tripwire });
    expect(run!.attributes).toMatchObject({ tripwireAbort: tripwire });
  });

  it('hides model spans the agent tracingPolicy marks internal', async () => {
    const { observability, events, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Hello.',
      tracingPolicy: { internal: InternalSpans.MODEL },
      fixtures: llm => llm.onMessage(/.*/, { content: 'Hi.' }),
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
    });

    const exported = events.filter(e => e.type === TracingEventType.SPAN_ENDED).map(e => e.exportedSpan.type);
    expect(exported.filter(type => type.startsWith('model_'))).toEqual([]);
  });
});
