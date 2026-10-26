import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { NetworkChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  isAgentRequest,
  isCompletionRequest,
  isRoutingRequest,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * Basic agent.network() loop behaviour: the iteration counter on routing chunks
 * starts at 0 (#9314), routing to a workflow does not hit the deprecated
 * WorkflowRunOutput iterator, the network usage total equals the usage reported
 * on the routing/agent/workflow end chunks, and a network without memory is
 * rejected up front.
 *
 * Replaces the skipped "LOOP" and "memory is not configured" cases from
 * packages/core/src/agent/agent-network.e2e.test.ts.
 */
describeForAllEngines(
  'AIMock network scenario: loop basics',
  engine => {
    const getMock = useLoopScenarioAimock();

    const tool1 = createTool({
      id: 'tool1',
      description: 'Tells you about cool stuff',
      inputSchema: z.object({ howCool: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: async input => ({ text: `How cool? ${input.howCool}` }),
    });

    const cityWorkflow = createWorkflow({
      id: 'workflow1',
      description: 'Researches a city',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(
        createStep({
          id: 'describe-city',
          inputSchema: z.object({ city: z.string() }),
          outputSchema: z.object({ text: z.string() }),
          execute: async ({ inputData }) => ({ text: `${inputData.city} is a city` }),
        }),
      )
      .commit();

    function buildNetwork(llm: ReturnType<typeof getMock>, id: string) {
      const researcher = new Agent({
        id: 'researcher',
        name: 'researcher',
        description: 'Researches topics',
        instructions: 'LB_RESEARCH_MARK Answer in bullet points.',
        model: scenarioModel(llm),
      });
      return new Agent({
        id,
        name: id,
        instructions: 'Research things.',
        model: scenarioModel(llm),
        agents: { researcher },
        workflows: { workflow1: cityWorkflow },
        tools: { tool1 },
        memory: new MockMemory(),
      });
    }

    const iterations = (chunks: NetworkChunkType[]) =>
      chunks.filter(c => c.type === 'routing-agent-end').map(c => (c.payload as { iteration: number }).iteration);

    it.each([
      ['tool', routeTo('tool1', 'tool', JSON.stringify({ howCool: 'very' }))],
      ['workflow', routeTo('workflow1', 'workflow', JSON.stringify({ city: 'Paris' }))],
      ['agent', routeTo('researcher', 'agent', 'Research dolphins')],
    ] as const)('numbers the first iteration 0 when routing to a %s', async (kind, route) => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, route);
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('LB_RESEARCH_MARK') }, { content: '- dolphins swim' });
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Done.'));

      const network = buildNetwork(llm, `lb-iter-${kind}`);
      const chunks = await drain(
        await forEngine(network, engine).network(`Run the ${kind}`, {
          memory: { thread: `lb-iter-${kind}`, resource: 'lb' },
        }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      expect(iterations(chunks)).toEqual([0]);
    });

    it('increments the iteration for each routing step (agent, then workflow)', async () => {
      const llm = getMock();
      let routingCalls = 0;
      let completionCalls = 0;
      llm.on(
        { endpoint: 'chat', predicate: req => isRoutingRequest(req) && routingCalls++ === 0 },
        routeTo('researcher', 'agent', 'Research dolphins'),
      );
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('workflow1', 'workflow', JSON.stringify({ city: 'Miami' })),
      );
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('LB_RESEARCH_MARK') }, { content: '- dolphins: Miami' });
      llm.on(
        { endpoint: 'chat', predicate: req => isCompletionRequest(req) && completionCalls++ === 0 },
        complete('', false),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Miami is a city.'));

      const network = buildNetwork(llm, 'lb-iter-multi');
      const chunks = await drain(
        await forEngine(network, engine).network('Research dolphins then run workflow1 on where they live', {
          memory: { thread: 'lb-iter-multi', resource: 'lb' },
          maxSteps: 3,
        }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      expect(iterations(chunks)).toEqual([0, 1]);
      expect(chunks.some(c => c.type === 'agent-execution-end')).toBe(true);
      expect(chunks.some(c => c.type === 'workflow-execution-end')).toBe(true);
    });

    it('does not log the WorkflowRunOutput iterator deprecation when running a workflow', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('workflow1', 'workflow', JSON.stringify({ city: 'Paris' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Paris is a city.'));
      const warn = vi.spyOn(console, 'warn');

      try {
        const network = buildNetwork(llm, 'lb-deprecation');
        const chunks = await drain(
          await forEngine(network, engine).network('Execute workflow1 on Paris', {
            memory: { thread: 'lb-deprecation', resource: 'lb' },
          }),
        );

        expect(chunks.some(c => c.type === 'workflow-execution-end')).toBe(true);
        const deprecations = warn.mock.calls.filter(args =>
          String(args[0]).includes('WorkflowRunOutput[Symbol.asyncIterator]'),
        );
        expect(deprecations).toEqual([]);
      } finally {
        warn.mockRestore();
      }
    });

    function sumEndUsage(chunks: NetworkChunkType[]) {
      const total = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      for (const c of chunks) {
        if (c.type !== 'routing-agent-end' && c.type !== 'agent-execution-end' && c.type !== 'workflow-execution-end') {
          continue;
        }
        const usage = (c.payload as { usage?: Record<string, number | undefined> }).usage;
        total.inputTokens += usage?.inputTokens ?? 0;
        total.outputTokens += usage?.outputTokens ?? 0;
        total.totalTokens += usage?.totalTokens ?? 0;
      }
      return total;
    }

    it('totals usage from a workflow whose steps stream agents', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        {
          ...routeTo('agentWorkflow', 'workflow', JSON.stringify({ researchTopic: 'dolphins' })),
          usage: { input_tokens: 3, output_tokens: 2 },
        },
      );
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('LB_STEP_ONE') },
        { content: '- dolphins swim', usage: { input_tokens: 11, output_tokens: 7 } },
      );
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('LB_STEP_TWO') },
        { content: 'Dolphins swim.', usage: { input_tokens: 13, output_tokens: 5 } },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Dolphins swim.'));

      const stepOne = new Agent({
        id: 'stepOne',
        name: 'stepOne',
        instructions: 'LB_STEP_ONE Research.',
        model: scenarioModel(llm),
      });
      const stepTwo = new Agent({
        id: 'stepTwo',
        name: 'stepTwo',
        instructions: 'LB_STEP_TWO Synthesize.',
        model: scenarioModel(llm),
      });
      const agentWorkflow = createWorkflow({
        id: 'agentWorkflow',
        description: 'Researches a topic with two agents',
        inputSchema: z.object({ researchTopic: z.string() }),
        outputSchema: z.object({ text: z.string() }),
      })
        .map(async ({ inputData }) => ({ prompt: inputData.researchTopic }))
        .then(createStep(stepOne))
        .map(async ({ inputData }) => ({ prompt: inputData.text }))
        .then(createStep(stepTwo))
        .commit();
      const network = new Agent({
        id: 'lb-usage-workflow',
        name: 'lb-usage-workflow',
        instructions: 'Research things.',
        model: scenarioModel(llm),
        workflows: { agentWorkflow },
        memory: new MockMemory(),
      });

      const stream = await forEngine(network, engine).network('Research dolphins', {
        memory: { thread: 'lb-usage-workflow', resource: 'lb' },
      });
      const chunks = await drain(stream);

      const workflowEnd = chunks.find(c => c.type === 'workflow-execution-end');
      expect((workflowEnd?.payload as { usage: unknown }).usage).toMatchObject({ inputTokens: 24, outputTokens: 12 });
      const expected = sumEndUsage(chunks);
      expect(expected).toMatchObject({ inputTokens: 27, outputTokens: 14 });
      await expect(stream.usage).resolves.toMatchObject(expected);
    });

    it('totals usage from a routed agent and reports it on the finish chunk', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        { ...routeTo('researcher', 'agent', 'Research dolphins'), usage: { input_tokens: 3, output_tokens: 2 } },
      );
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('LB_RESEARCH_MARK') },
        { content: '- dolphins swim', usage: { input_tokens: 17, output_tokens: 9 } },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Dolphins swim.'));

      const network = buildNetwork(llm, 'lb-usage-agent');
      const stream = await forEngine(network, engine).network('Research dolphins using researcher', {
        memory: { thread: 'lb-usage-agent', resource: 'lb' },
      });
      const chunks = await drain(stream);

      const expected = sumEndUsage(chunks);
      expect(expected).toMatchObject({ inputTokens: 20, outputTokens: 11 });
      await expect(stream.usage).resolves.toMatchObject(expected);
      const finish = chunks.find(c => c.type === 'network-execution-event-finish');
      expect((finish?.payload as { usage: unknown }).usage).toMatchObject(expected);
    });

    it('rejects a network whose routing agent has no memory', async () => {
      const llm = getMock();
      const calculator = new Agent({
        id: 'calculator',
        name: 'calculator',
        description: 'Does arithmetic',
        instructions: 'Calculate.',
        model: scenarioModel(llm),
      });
      const orchestrator = new Agent({
        id: 'lb-no-memory',
        name: 'lb-no-memory',
        instructions: 'Orchestrate.',
        model: scenarioModel(llm),
        agents: { calculator },
      });

      await expect(forEngine(orchestrator, engine).network([{ role: 'user', content: 'Hi!' }])).rejects.toMatchObject({
        id: 'AGENT_NETWORK_MEMORY_REQUIRED',
      });
      expect(llm.getRequests()).toEqual([]);
    });
  },
  NETWORK_ENGINE_SKIP,
);
