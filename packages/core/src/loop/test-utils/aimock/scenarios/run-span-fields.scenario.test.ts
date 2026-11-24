import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from '../../../../../../../observability/mastra/src/default';
import { Agent } from '../../../../agent';
import { UnixSocketPubSub } from '../../../../events/unix-socket-pubsub';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InternalSpans, SpanType, TracingEventType } from '../../../../observability';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
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

  it('keeps the answer when the observability config selector throws at the end of the run', async () => {
    const memory = new MockMemory();
    const exporter = {
      name: 'noop',
      exportTracingEvent: async () => {},
      flush: async () => {},
      shutdown: async () => {},
    };
    const observability = new Observability({
      configs: {
        acme: { serviceName: 'acme', exporters: [exporter] },
        other: { serviceName: 'other', exporters: [exporter] },
      },
      configSelector: ({ requestContext }) => (requestContext!.get('tenant') as string).toLowerCase(),
    });
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      memory,
      threadId: 'thread',
      resourceId: 'user',
      requestContext: new RequestContext([['tenant', 'Acme']]),
      outputProcessors: [
        {
          id: 'clear-tenant',
          processOutputStep: ({ messages, requestContext }: any) => {
            requestContext.delete('tenant');
            return messages;
          },
        },
      ],
      prompt: 'Hello.',
      fixtures: llm => llm.onMessage(/.*/, { content: 'Hi.' }),
    });

    expect(await output.text).toBe('Hi.');
    await expect
      .poll(async () =>
        (await memory.recall({ threadId: 'thread', resourceId: 'user' })).messages.map(message => message.role),
      )
      .toEqual(['user', 'assistant']);
  });
});

describe('run and generation span fields on a worker in another process', () => {
  const getMock = useLoopScenarioAimock();

  it('reports the usage of hidden model spans on the run', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'run-span-fields-'));
    const pubsubs = [0, 1].map(() => new UnixSocketPubSub(join(directory, 'pubsub.sock')));
    const storage = new InMemoryStore();
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Hi.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
    const [api, worker] = pubsubs.map((pubsub, index) => {
      const captured = capture();
      const agent = new Agent({
        id: 'support',
        name: 'Support',
        instructions: 'Help.',
        model: openai('gpt-4o'),
        durable: { executionEngine: 'evented' },
        options: { tracingPolicy: { internal: InternalSpans.MODEL } },
      });
      const { observability } = captured;
      const workers = index === 0 ? { workers: false as const } : {};
      return {
        ...captured,
        agent,
        mastra: new Mastra({ agents: { agent }, storage, pubsub, observability, logger: false, ...workers }),
      };
    }) as [any, any];
    try {
      await worker.mastra.startWorkers();
      expect(await (await api.agent.stream('Hello.')).text).toBe('Hi.');
      await expect.poll(() => worker.ended().length).toBe(1);

      expect(worker.ended()[0].attributes.internalUsage).toMatchObject({ inputTokens: expect.any(Number) });
      expect(worker.ended(SpanType.MODEL_GENERATION)).toEqual([]);
    } finally {
      await api.mastra.shutdown();
      await worker.mastra.shutdown();
      for (const pubsub of pubsubs) await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);
});
