import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { MockMemory } from '../../../../memory/mock';
import type { ChunkType } from '../../../../stream/types';
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

    function setup({ requireApproval = false } = {}) {
      const llm = getMock();
      const toolRuns: string[] = [];
      const lookupOrder = createTool({
        id: 'lookup-order',
        description: 'Look up an order',
        inputSchema: z.object({ orderId: z.string() }),
        requireApproval,
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
      // Answers depend on the tool result each model actually receives, so a
      // declined lookup can't produce a shipped status.
      const lastToolResult = (req: ChatCompletionRequest) => String(req.messages.at(-1)?.content ?? '');
      llm.on(
        {
          endpoint: 'chat',
          predicate: req =>
            !isWorkerSupervisor(req) && lastIsToolResult(req) && lastToolResult(req).includes('"status":"shipped"'),
        },
        { content: 'Order 42 has shipped.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => !isWorkerSupervisor(req) && lastIsToolResult(req) },
        { content: "I couldn't look up order 42." },
      );
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => isWorkerSupervisor(req) && lastIsToolResult(req) && lastToolResult(req).includes('shipped'),
        },
        { content: 'Your order 42 has shipped.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isWorkerSupervisor(req) && lastIsToolResult(req) },
        { content: "Sorry, I couldn't check order 42." },
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
      const buildSupervisor = async (memory?: MockMemory) => {
        const shared = await createSharedAgent(llm, { agents: { worker: worker as unknown as Agent }, memory });
        shared.mastra.addAgent(worker, 'worker');
        return shared;
      };

      // The worker transcript the delegation reports and saves: one thread under the
      // worker resource, holding the prompt once and the worker response once, even
      // though the durable run already saved those rows itself.
      const workerTranscript = async (
        memory: MockMemory,
        delegation: { subAgentThreadId?: string; subAgentResourceId?: string },
      ) => {
        const { threads } = await memory.listThreads({ filter: { resourceId: delegation.subAgentResourceId! } });
        expect(threads.map(t => t.id)).toEqual([delegation.subAgentThreadId]);
        const { messages } = await memory.recall({
          threadId: delegation.subAgentThreadId!,
          resourceId: delegation.subAgentResourceId!,
        });
        return messages.map(m => ({
          role: m.role,
          parts: m.content.parts.flatMap(part =>
            part.type === 'text'
              ? [part.text]
              : part.type === 'tool-invocation'
                ? [`${part.toolInvocation.toolName}:${part.toolInvocation.state}`]
                : [],
          ),
        }));
      };

      return { llm, toolRuns, delegationResultSeenBySupervisor, buildSupervisor, workerTranscript };
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

    it('a streaming supervisor saves the sub-agent transcript once on the sub-agent thread', async () => {
      const { toolRuns, buildSupervisor, workerTranscript } = setup();
      const memory = new MockMemory();
      const { agent } = await buildSupervisor(memory);

      const output = await agent.stream('Where is order 42?', {
        memory: { thread: `durable-worker-transcript-${kind}`, resource: 'durable-worker-transcript-user' },
        maxSteps: 3,
      });

      expect(await output.text).toBe('Your order 42 has shipped.');
      expect(toolRuns).toEqual(['42']);
      const [delegation] = await output.toolResults;
      expect(await workerTranscript(memory, delegation!.payload.result as any)).toEqual([
        { role: 'user', parts: ['Where is order 42?'] },
        { role: 'assistant', parts: ['lookup-order:result', 'Order 42 has shipped.'] },
      ]);
    });

    it('a generating supervisor receives the sub-agent answer after the sub-agent runs its tool', async () => {
      const { toolRuns, delegationResultSeenBySupervisor, buildSupervisor } = setup();
      const { agent } = await buildSupervisor();

      const result = await agent.generate('Where is order 42?', { maxSteps: 3 });

      expect(toolRuns).toEqual(['42']);
      expect(delegationResultSeenBySupervisor()).toMatchObject({ role: 'tool', content: 'Order 42 has shipped.' });
      expect(result.text).toBe('Your order 42 has shipped.');
    });

    type RunHandle = { fullStream: AsyncIterable<ChunkType> };

    // A durable worker keeps its stream open across a suspension unless asked to
    // close it, so the supervisor would wait forever for the worker's approval.
    async function streamToApproval() {
      const { toolRuns, delegationResultSeenBySupervisor, buildSupervisor, workerTranscript } = setup({
        requireApproval: true,
      });
      const memory = new MockMemory();
      const { agent } = await buildSupervisor(memory);
      const thread = `durable-worker-approval-${kind}`;
      const resource = 'durable-worker-approval-user';

      const run = (await agent.stream('Where is order 42?', {
        memory: { thread, resource },
        maxSteps: 3,
      })) as unknown as RunHandle;
      // Bounded so a stalled stream fails on the assertion below instead of the test timeout.
      const firstTypes: string[] = [];
      const ended = (async () => {
        for await (const chunk of run.fullStream) firstTypes.push(chunk.type);
        return true;
      })();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled = new Promise<false>(resolve => {
        timer = setTimeout(() => resolve(false), 10_000);
      });
      const streamEnded = await Promise.race([ended, stalled]);
      clearTimeout(timer);
      expect(streamEnded, `first stream chunks: ${firstTypes.join(', ')}`).toBe(true);
      expect(firstTypes, `first stream chunks: ${firstTypes.join(', ')}`).toContain('tool-call-approval');
      expect(toolRuns).toEqual([]);

      const entry = await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
        const pending = [...messages].reverse().find((m: any) => m.content?.metadata?.pendingToolApprovals) as any;
        expect(pending).toBeDefined();
        return Object.values(pending.content.metadata.pendingToolApprovals)[0] as { runId: string; toolCallId: string };
      });

      return { agent, entry, thread, resource, memory, toolRuns, delegationResultSeenBySupervisor, workerTranscript };
    }

    async function drainText(stream: AsyncIterable<ChunkType>) {
      const types: string[] = [];
      let text = '';
      let delegation: { subAgentThreadId?: string; subAgentResourceId?: string } | undefined;
      for await (const chunk of stream) {
        types.push(chunk.type);
        if (chunk.type === 'text-delta') text += (chunk.payload as { text: string }).text;
        if (chunk.type === 'tool-result') delegation = (chunk.payload as { result: typeof delegation }).result;
      }
      return { types, text, delegation: delegation! };
    }

    it('a streaming supervisor surfaces the sub-agent tool approval and finishes after it is approved', async () => {
      const { agent, entry, thread, resource, memory, toolRuns, delegationResultSeenBySupervisor, workerTranscript } =
        await streamToApproval();

      const resumed = (await agent.approveToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        memory: { thread, resource },
      } as any)) as unknown as RunHandle;
      const { types, text, delegation } = await drainText(resumed.fullStream);

      expect(types, `resumed chunks: ${types.join(', ')}`).not.toContain('error');
      expect(toolRuns).toEqual(['42']);
      expect(delegationResultSeenBySupervisor()).toMatchObject({ role: 'tool', content: 'Order 42 has shipped.' });
      expect(text).toBe('Your order 42 has shipped.');
      // The resumed delegation reports and saves to the thread the suspended run used.
      expect(await workerTranscript(memory, delegation)).toEqual([
        { role: 'user', parts: ['Where is order 42?'] },
        { role: 'assistant', parts: ['lookup-order:result', 'Order 42 has shipped.'] },
      ]);
    });

    it('a streaming supervisor receives the sub-agent refusal without running the tool after it is declined', async () => {
      const { agent, entry, thread, resource, memory, toolRuns, delegationResultSeenBySupervisor, workerTranscript } =
        await streamToApproval();

      const resumed = (await agent.declineToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        memory: { thread, resource },
      } as any)) as unknown as RunHandle;
      const { types, text, delegation } = await drainText(resumed.fullStream);

      expect(types, `resumed chunks: ${types.join(', ')}`).not.toContain('error');
      expect(toolRuns).toEqual([]);
      expect(delegationResultSeenBySupervisor()).toStrictEqual({
        role: 'tool',
        content: "I couldn't look up order 42.",
        tool_call_id: 'call-worker-1',
      });
      expect(text).toBe("Sorry, I couldn't check order 42.");
      expect(await workerTranscript(memory, delegation)).toEqual([
        { role: 'user', parts: ['Where is order 42?'] },
        { role: 'assistant', parts: ['lookup-order:output-denied', "I couldn't look up order 42."] },
      ]);
    });
  },
);

/**
 * A worker tool's transcript transform must still hold on the worker thread
 * after a streaming supervisor saves the delegated transcript there.
 */
describe.each(['plain', 'durable', 'evented'] as const)(
  'AIMock scenario: delegated transcript keeps a %s sub-agent tool transcript transform',
  kind => {
    const getMock = useLoopScenarioAimock();

    it('stores the transformed tool output, not the raw payload, on the sub-agent thread', async () => {
      const llm = getMock();
      const lookupOrder = createTool({
        id: 'lookup-order',
        description: 'Look up an order',
        inputSchema: z.object({ orderId: z.string() }),
        execute: async ({ orderId }) => ({ orderId, status: 'shipped', trackingToken: 'RAW-TRACKING-TOKEN' }),
        transform: {
          transcript: {
            output: ({ output }) => ({ orderId: (output as { orderId: string }).orderId, status: 'shipped' }),
          },
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
      const worker =
        kind === 'plain'
          ? inner
          : kind === 'durable'
            ? createDurableAgent({ agent: inner })
            : createEventedAgent({ agent: inner });

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

      const memory = new MockMemory();
      const { agent, mastra } = await createSharedAgent(llm, {
        agents: { worker: worker as unknown as Agent },
        memory,
      });
      if (kind !== 'plain') mastra.addAgent(worker, 'worker');

      const output = await agent.stream('Where is order 42?', {
        memory: { thread: `delegated-transform-${kind}`, resource: 'delegated-transform-user' },
        maxSteps: 3,
      });
      expect(await output.text).toBe('Your order 42 has shipped.');

      const [delegation] = await output.toolResults;
      const { subAgentThreadId, subAgentResourceId } = delegation!.payload.result as {
        subAgentThreadId: string;
        subAgentResourceId: string;
      };
      const { messages } = await memory.recall({ threadId: subAgentThreadId, resourceId: subAgentResourceId });
      const results = messages.flatMap(m =>
        m.content.parts.flatMap(part =>
          part.type === 'tool-invocation' && part.toolInvocation.state === 'result' ? [part.toolInvocation.result] : [],
        ),
      );
      expect(results).toEqual([{ orderId: '42', status: 'shipped' }]);
      expect(JSON.stringify(messages)).not.toContain('RAW-TRACKING-TOKEN');
    });
  },
);
