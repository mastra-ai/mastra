import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { ConsoleLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { ErrorProcessor, InputProcessor, OutputProcessor } from '../../processors';
import { createProcessorWorkflowRequestContext } from '../../processors/agent-context';
import { ProcessorRunner } from '../../processors/runner';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../../processors/step-schema';
import { RequestContext } from '../../request-context';
import { createStep, createWorkflow } from '../../workflows';
import { PUBSUB_SYMBOL } from '../../workflows/constants';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';
import { globalRunRegistry } from '../durable/run-registry';
import { createDurableLLMExecutionStep } from '../durable/workflows/steps/llm-execution';
import { MessageList } from '../message-list';

function createTextModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'Hello' }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createRecoveringTextModel(): LanguageModelV2 {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        throw new APICallError({
          message: 'Invalid request',
          url: 'https://example.com/model',
          requestBodyValues: {},
          statusCode: 400,
          isRetryable: false,
        });
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Recovered' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

type Observation = { hook: string; agent: unknown };

function inputProcessor(observations: Observation[]): InputProcessor {
  return {
    id: 'agent-aware-input',
    processInput: async ({ agent, messages }) => {
      observations.push({ hook: 'processInput', agent });
      return messages;
    },
    processInputStep: async ({ agent }) => {
      observations.push({ hook: 'processInputStep', agent });
    },
    processLLMRequest: async ({ agent, prompt }) => {
      observations.push({ hook: 'processLLMRequest', agent });
      return { prompt };
    },
    processLLMResponse: async ({ agent }) => {
      observations.push({ hook: 'processLLMResponse', agent });
    },
  };
}

function outputProcessor(observations: Observation[]): OutputProcessor {
  return {
    id: 'agent-aware-output',
    processOutputStream: async ({ agent, part }) => {
      observations.push({ hook: 'processOutputStream', agent });
      return part;
    },
    processOutputResult: async ({ agent, messages }) => {
      observations.push({ hook: 'processOutputResult', agent });
      return messages;
    },
    processOutputStep: async ({ agent, messages }) => {
      observations.push({ hook: 'processOutputStep', agent });
      return messages;
    },
  };
}

function errorProcessor(observations: Observation[]): ErrorProcessor {
  return {
    id: 'agent-aware-error',
    processAPIError: async ({ agent }) => {
      observations.push({ hook: 'processAPIError', agent });
      return { retry: true };
    },
  };
}

function expectAgentForHooks(observations: Observation[], agent: Agent, expectedHooks: string[]) {
  expect(new Set(observations.map(({ hook }) => hook))).toEqual(new Set(expectedHooks));
  expect(observations.every(observation => observation.agent === agent)).toBe(true);
}

describe('processor agent context', () => {
  const pubsubs: EventEmitterPubSub[] = [];
  const runIds: string[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
    for (const runId of runIds.splice(0)) {
      if (globalRunRegistry.has(runId)) globalRunRegistry.delete(runId);
    }
  });

  it.each(['generate', 'stream'] as const)(
    'provides the owning agent to every standard hook during %s',
    async method => {
      const inputObservations: Observation[] = [];
      const outputObservations: Observation[] = [];
      const agent = new Agent({
        id: `processor-context-${method}`,
        instructions: 'Respond briefly.',
        model: createTextModel(),
        inputProcessors: [inputProcessor(inputObservations)],
        outputProcessors: [outputProcessor(outputObservations)],
      });

      if (method === 'generate') {
        await agent.generate('Hello');
      } else {
        await (await agent.stream('Hello')).consumeStream();
      }

      expectAgentForHooks(inputObservations, agent, [
        'processInput',
        'processInputStep',
        'processLLMRequest',
        'processLLMResponse',
      ]);
      expectAgentForHooks(outputObservations, agent, [
        'processOutputStream',
        'processOutputResult',
        'processOutputStep',
      ]);
    },
  );

  it('lets a processor use the owning agent with its request context to resolve memory', async () => {
    const memory = new MockMemory();
    const requestContext = new RequestContext([['tenant', 'test']]);
    let observedMemory: unknown;
    let observedRequestContext: unknown;
    const agent = new Agent({
      id: 'processor-memory-context',
      instructions: 'Respond briefly.',
      model: createTextModel(),
      memory,
      inputProcessors: [
        {
          id: 'memory-reader',
          processInput: async ({ agent: owner, messages, requestContext: context }) => {
            observedRequestContext = context;
            observedMemory = await owner?.getMemory({ requestContext: context });
            return messages;
          },
        },
      ],
    });

    await agent.generate('Hello', { requestContext });

    expect(observedRequestContext).toBe(requestContext);
    expect(observedMemory).toBe(memory);
  });

  it('provides the owning agent inside a prebuilt processor workflow', async () => {
    let observed: unknown;
    const workflowProcessor: InputProcessor = {
      id: 'nested-agent-aware-input',
      processInput: async ({ agent, messages }) => {
        observed = agent;
        return messages;
      },
    };
    const workflow = createWorkflow({
      id: 'prebuilt-processor-workflow',
      inputSchema: ProcessorStepInputSchema,
      outputSchema: ProcessorStepOutputSchema,
    })
      .then(createStep(workflowProcessor))
      .commit();
    const agent = new Agent({
      id: 'nested-processor-context',
      instructions: 'Respond briefly.',
      model: createTextModel(),
      inputProcessors: [workflow],
    });

    await agent.generate('Hello');

    expect(observed).toBe(agent);
  });

  it('isolates two agents sharing one prebuilt processor workflow', async () => {
    const observed = new Map<string, unknown>();
    let firstEnteredResolve!: () => void;
    const firstEntered = new Promise<void>(resolve => (firstEnteredResolve = resolve));
    let releaseResolve!: () => void;
    const release = new Promise<void>(resolve => (releaseResolve = resolve));
    const processor: InputProcessor = {
      id: 'shared-agent-aware-input',
      processInput: async ({ agent, messages }) => {
        firstEnteredResolve();
        await release;
        observed.set(agent?.id ?? 'unknown', agent);
        return messages;
      },
    };
    const workflow = createWorkflow({
      id: 'shared-processor-workflow',
      inputSchema: ProcessorStepInputSchema,
      outputSchema: ProcessorStepOutputSchema,
    })
      .then(createStep(processor))
      .commit();
    const agentA = new Agent({
      id: 'shared-agent-a',
      instructions: 'Respond briefly.',
      model: createTextModel(),
      inputProcessors: [workflow],
    });
    const agentB = new Agent({
      id: 'shared-agent-b',
      instructions: 'Respond briefly.',
      model: createTextModel(),
      inputProcessors: [workflow],
    });

    const generateA = agentA.generate('A');
    await firstEntered;
    const generateB = agentB.generate('B');
    releaseResolve();
    await Promise.all([generateA, generateB]);

    expect(observed.get(agentA.id)).toBe(agentA);
    expect(observed.get(agentB.id)).toBe(agentB);
  });

  it.each(['generate', 'stream'] as const)('provides the base agent to durable hooks during %s', async method => {
    const inputObservations: Observation[] = [];
    const outputObservations: Observation[] = [];
    const baseAgent = new Agent({
      id: `durable-processor-context-${method}`,
      instructions: 'Respond briefly.',
      model: createTextModel(),
      inputProcessors: [inputProcessor(inputObservations)],
      outputProcessors: [outputProcessor(outputObservations)],
    });
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    if (method === 'generate') {
      await durableAgent.generate('Hello');
    } else {
      const { output, cleanup } = await durableAgent.stream('Hello');
      await output.consumeStream();
      cleanup();
    }

    expectAgentForHooks(inputObservations, baseAgent, [
      'processInput',
      'processInputStep',
      'processLLMRequest',
      'processLLMResponse',
    ]);
    expectAgentForHooks(outputObservations, baseAgent, [
      'processOutputStream',
      'processOutputResult',
      'processOutputStep',
    ]);
  });

  it('rehydrates the base agent for cross-process durable execution', async () => {
    const memory = new MockMemory();
    let observedAgent: unknown;
    let observedMemory: unknown;
    const baseAgent = new Agent({
      id: 'cross-process-processor-context',
      instructions: 'Respond briefly.',
      model: createTextModel(),
      inputProcessors: [
        {
          id: 'cross-process-memory-reader',
          processInputStep: async ({ agent, requestContext }) => {
            observedAgent = agent;
            observedMemory = await agent?.getMemory({ requestContext });
          },
        },
      ],
    });
    const mastra = new Mastra({ agents: { baseAgent } });
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const preparation = await durableAgent.prepare('Hello');
    runIds.push(preparation.runId);

    vi.spyOn(baseAgent, 'getMemory').mockResolvedValue(memory as any);
    globalRunRegistry.set(preparation.runId, {
      isPlaceholder: true,
      tools: {},
      model: undefined,
    } as any);

    await (createDurableLLMExecutionStep() as any).execute({
      inputData: preparation.workflowInput,
      mastra,
      requestContext: new RequestContext(),
      tracingContext: {},
      abortSignal: undefined,
      [PUBSUB_SYMBOL]: pubsub,
    });

    expect(observedAgent).toBe(baseAgent);
    expect(observedMemory).toBe(memory);
  });

  it.each([
    ['standard', false],
    ['durable', true],
  ] as const)('provides the base agent to %s API error processors', async (_label, durable) => {
    const observations: Observation[] = [];
    const baseAgent = new Agent({
      id: `${durable ? 'durable-' : ''}error-processor-context`,
      instructions: 'Respond briefly.',
      model: createRecoveringTextModel(),
      errorProcessors: [errorProcessor(observations)],
    });

    if (durable) {
      const pubsub = new EventEmitterPubSub();
      pubsubs.push(pubsub);
      await createDurableAgent({ agent: baseAgent, pubsub }).generate('Hello');
    } else {
      await (await baseAgent.stream('Hello')).consumeStream();
    }

    expectAgentForHooks(observations, baseAgent, ['processAPIError']);
  });

  it('keeps agent optional for standalone processor execution', async () => {
    let observed: unknown = 'not-called';
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'standalone',
          processInput: async ({ agent, messages }) => {
            observed = agent;
            return messages;
          },
        },
      ],
      outputProcessors: [],
      logger: new ConsoleLogger({ level: 'error' }),
      agentName: 'standalone',
    });

    const messageList = new MessageList().add({ role: 'user', content: 'Hello' }, 'input');
    await runner.runInputProcessors(messageList);

    expect(observed).toBeUndefined();
  });

  it('keeps a processor workflow agent reference out of serialized request context', () => {
    const agent = new Agent({
      id: 'serialization-safe-processor-agent',
      instructions: 'Respond briefly.',
      model: createTextModel(),
    });
    const context = createProcessorWorkflowRequestContext(new RequestContext([['public', 'value']]), agent);
    const serialized = JSON.stringify(context);

    expect(serialized).toContain('"public":"value"');
    expect(serialized).toContain('"__mastra_processor_agent_id":"serialization-safe-processor-agent"');
    expect(serialized).not.toContain('__mastra_processor_agent_ref');
  });
});
