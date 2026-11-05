import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A sub-agent registered under `agents` is exposed to the supervisor as an
 * `agent-<key>` tool. Its tool result carries the sub-agent's final text plus
 * the thread, resource and tool results of the delegated run.
 *
 * Replaces the hash-matched `tool-handling.e2e` recording.
 */

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-researchAgent');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

describeForAllEngines('AIMock loop scenario: sub-agent delegation result', engine => {
  const getMock = useLoopScenarioAimock();

  it('returns the sub-agent text and run identity as the agent-* tool result', async () => {
    const llm = getMock();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const researchAgent = new Agent({
      id: 'research-agent',
      name: 'research-agent',
      description: 'Researches topics',
      instructions: 'You are a research agent.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output, chunks, requests } = await runLoopScenario({
      engine,
      llm,
      collectChunks: true,
      instructions: 'Delegate research tasks to specialized agents.',
      prompt: 'Use the research agent to find information about TypeScript',
      agents: { researchAgent },
      fixtures: m => {
        m.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-research-1', name: 'agent-researchAgent', arguments: { prompt: 'TypeScript' } }] },
        );
        m.on({ endpoint: 'chat', predicate: req => !isSupervisor(req) }, { content: 'TypeScript adds static types.' });
        m.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'TypeScript adds static types to JavaScript.' },
        );
      },
    });

    const toolResults = (await output.toolResults) as Array<{ payload: { toolName: string; result: unknown } }>;
    expect(toolResults.map(r => r.payload.toolName)).toEqual(['agent-researchAgent']);
    expect(toolResults[0]!.payload.result).toStrictEqual({
      text: 'TypeScript adds static types.',
      subAgentThreadId: expect.any(String),
      subAgentResourceId: expect.any(String),
      subAgentToolResults: [],
    });

    // COR-1440: durable/evented computed toModelOutput for persistence but dropped
    // its metadata from the public tool-result chunk.
    const delegationResults = chunks?.filter(
      chunk => chunk.type === 'tool-result' && chunk.payload.toolName === 'agent-researchAgent',
    );
    expect(delegationResults).toHaveLength(1);
    expect(delegationResults![0]).toMatchObject({
      payload: {
        providerMetadata: {
          mastra: { modelOutput: { type: 'text', value: 'TypeScript adds static types.' } },
        },
      },
    });
    const continuation = requests.find(req => isSupervisor(req.body) && lastIsToolResult(req.body));
    expect(continuation?.body.messages.at(-1)).toMatchObject({
      role: 'tool',
      content: 'TypeScript adds static types.',
    });
  });
});

/**
 * A plain supervisor delegating to a DurableAgent or EventedAgent sub-agent.
 *
 * The cases above vary the supervisor's engine with plain sub-agents; here the
 * supervisor is a plain Agent and the worker is the durable wrapper, which is
 * how users register a durable sub-agent. COR-1511.
 */
const isWorkerSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');

describe.each(['durable', 'evented'] as const)(
  'AIMock scenario: plain supervisor delegating to a %s sub-agent',
  kind => {
    const getMock = useLoopScenarioAimock();

    function setup() {
      const llm = getMock();
      const toolRuns: string[] = [];
      const lookupOrder = createTool({
        id: 'lookup-order',
        description: 'Look up an order',
        inputSchema: z.object({ orderId: z.string() }),
        execute: async ({ orderId }) => {
          toolRuns.push(orderId);
          return { orderId, status: 'shipped' };
        },
      });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const inner = new Agent({
        id: 'worker',
        name: 'worker',
        description: 'Looks up orders',
        instructions: 'You look up orders.',
        model: openai(SCENARIO_MODEL_ID),
        tools: { 'lookup-order': lookupOrder },
      });
      const worker = kind === 'durable' ? createDurableAgent({ agent: inner }) : createEventedAgent({ agent: inner });

      llm.on(
        { endpoint: 'chat', predicate: req => isWorkerSupervisor(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-worker-1', name: 'agent-worker', arguments: { prompt: 'Where is order 42?' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => !isWorkerSupervisor(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-lookup-1', name: 'lookup-order', arguments: { orderId: '42' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => !isWorkerSupervisor(req) && lastIsToolResult(req) },
        { content: 'Order 42 has shipped.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isWorkerSupervisor(req) && lastIsToolResult(req) },
        { content: 'Your order 42 has shipped.' },
      );

      const delegationResultSeenBySupervisor = () => {
        const continuation = llm
          .getRequests()
          .map(r => r.body as ChatCompletionRequest)
          .find(req => isWorkerSupervisor(req) && lastIsToolResult(req));
        return continuation?.messages.at(-1);
      };

      // Register the worker on the same Mastra as the supervisor, as an app would:
      // the durable run resolves its agent by id from Mastra.
      const buildSupervisor = async () => {
        const shared = await createSharedAgent(llm, { agents: { worker: worker as unknown as Agent } });
        shared.mastra.addAgent(worker, 'worker');
        return shared;
      };

      return { llm, toolRuns, delegationResultSeenBySupervisor, buildSupervisor };
    }

    // Bug: the stream delegation path read `streamResult.messageList`, which
    // DurableAgentStreamResult does not have, so the delegation tool failed after
    // the worker had already run its tools and the supervisor got error text.
    it('a streaming supervisor receives the sub-agent answer after the sub-agent runs its tool (COR-1511)', async () => {
      const { llm, toolRuns, delegationResultSeenBySupervisor, buildSupervisor } = setup();

      const { output } = await runLoopScenario({
        engine: 'normal',
        llm,
        prompt: 'Where is order 42?',
        sharedAgent: await buildSupervisor(),
        fixtures: () => {},
      });

      expect(toolRuns).toEqual(['42']);
      expect(delegationResultSeenBySupervisor()).toMatchObject({ role: 'tool', content: 'Order 42 has shipped.' });
      expect(await output.text).toBe('Your order 42 has shipped.');

      const [delegation] = await output.toolResults;
      expect(delegation?.payload.result).toStrictEqual({
        text: 'Order 42 has shipped.',
        subAgentThreadId: expect.any(String),
        subAgentResourceId: expect.any(String),
        subAgentToolResults: [
          {
            toolName: 'lookup-order',
            toolCallId: 'call-lookup-1',
            args: { orderId: '42' },
            result: { orderId: '42', status: 'shipped' },
            isError: undefined,
          },
        ],
      });
    });

    it('a generating supervisor receives the sub-agent answer after the sub-agent runs its tool', async () => {
      const { toolRuns, delegationResultSeenBySupervisor, buildSupervisor } = setup();
      const { agent } = await buildSupervisor();

      const result = await agent.generate('Where is order 42?', { maxSteps: 3 });

      expect(toolRuns).toEqual(['42']);
      expect(delegationResultSeenBySupervisor()).toMatchObject({ role: 'tool', content: 'Order 42 has shipped.' });
      expect(result.text).toBe('Your order 42 has shipped.');
    });
  },
);
