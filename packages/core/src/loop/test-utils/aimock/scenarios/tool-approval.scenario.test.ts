import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage, MessageList } from '../../../../agent/message-list';
import { TripWire } from '../../../../agent/trip-wire';
import type { AgentSuspendedEventData } from '../../../../agent/durable/types';
import { MockMemory } from '../../../../memory/mock';
import type { ProcessInputStepArgs, Processor } from '../../../../processors';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  runApprovalScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';
import { isDurableEngineVariant } from '../types';
import type { RunLoopScenarioOptions } from '../types';

type RunHandle = { fullStream: AsyncIterable<ChunkType>; runId: string };

/**
 * Drain a run's stream. Durable streams stay open while suspended, so stop at the approval chunk.
 */
async function drain(run: RunHandle, durable: boolean): Promise<ChunkType[]> {
  const chunks: ChunkType[] = [];
  for await (const chunk of run.fullStream) {
    chunks.push(chunk);
    if (durable && chunk.type === 'tool-call-approval') break;
  }
  return chunks;
}

const textOf = (chunks: ChunkType[]) =>
  chunks
    .filter(chunk => chunk.type === 'text-delta')
    .map(chunk => (chunk.payload as { text: string }).text)
    .join('');

/**
 * Aborts the run when it sees an empty message history, the way token-limiting processors do.
 * A resumed approval run must still hand processors the conversation, not an empty list.
 */
class RequiresHistoryProcessor implements Processor<'requires-history'> {
  public readonly id = 'requires-history';
  public readonly name = 'Requires History';

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
  }): Promise<MastraDBMessage[]> {
    if (args.messageList.get.all.db().length === 0) {
      args.abort('No messages to send to the model.');
    }
    return args.messages;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<void> {
    if (args.messageList.get.all.db().length === 0) {
      throw new TripWire('No messages to send to the model.', { retry: false });
    }
  }
}

/**
 * Regression class: tool approval + suspend/resume.
 *
 * With `requireToolApproval: true` the loop suspends before executing a tool,
 * emits a `tool-call-approval` chunk, and persists a snapshot. The run is then
 * resumed via approve/decline. These scenarios prove the suspend → resume →
 * continue path keeps message ordering and tool plumbing intact across the
 * snapshot boundary.
 */
describeForAllEngines('AIMock loop scenario: tool approval suspend/resume', engine => {
  const getMock = useLoopScenarioAimock();

  const makeLookupTool = () =>
    createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
    });

  it('approves a suspended tool call, executes it, then completes', async () => {
    const { output, chunks, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Look up the status for query alpha.',
      tools: { lookup_status: makeLookupTool() },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
          { content: 'The status for alpha is STATUS_OK:alpha.' },
        );
      },
    });

    // The loop suspended for exactly one approval, which we approved.
    expect(approvals).toEqual(['approve:call_lookup_alpha']);

    // The approval chunk was surfaced before resume.
    expect(chunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);

    // After approval the tool executed and the model produced its final answer.
    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    // Two model turns total: the tool-call turn and the post-result turn. The
    // approval pause does not insert an extra model request.
    expect(requests).toHaveLength(2);

    // The post-resume request carries the executed tool result keyed to the
    // original tool call id.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
  });

  it('declines a suspended tool call and reports the denial back to the model', async () => {
    const { output, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Look up the status for query beta.',
      tools: { lookup_status: makeLookupTool() },
      stopWhen: stepCountIs(5),
      decision: () => false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_beta', name: 'lookup_status', arguments: { query: 'beta' } }] },
        );
        // After the decline is reported as the tool result, the model wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Understood, I will not look that up.' });
      },
    });

    expect(approvals).toEqual(['decline:call_lookup_beta']);

    // A declined tool must NOT produce its real execution payload downstream.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serialized = JSON.stringify(turn2Messages);
    expect(serialized).not.toContain('STATUS_OK:beta');

    const text = await output.text;
    expect(text).toContain('will not look that up');
  });

  it('declineToolCall never executes when gated only by function requireToolApproval (#20470)', async () => {
    let executions = 0;
    const dangerTool = createTool({
      id: 'do_the_thing',
      description: 'Performs an irreversible action',
      inputSchema: z.object({ label: z.string() }),
      outputSchema: z.object({ done: z.boolean() }),
      execute: async () => {
        executions += 1;
        return { done: true };
      },
    });

    const { approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Use the label "beta".',
      tools: { do_the_thing: dangerTool },
      stopWhen: stepCountIs(5),
      requireToolApproval: ({ toolName }) => toolName === 'do_the_thing',
      decision: () => false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_20470_stream', name: 'do_the_thing', arguments: { label: 'beta' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Declined.' });
      },
    });

    expect(approvals).toEqual(['decline:call_20470_stream']);
    expect(executions).toBe(0);
    expect(JSON.stringify(requests[1]?.body?.messages ?? [])).not.toContain('"done":true');
  });

  it('streams the text the model wrote before the tool call ahead of the approval request', async () => {
    let executions = 0;
    const lookup = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        executions += 1;
        return { status: `STATUS_OK:${query}` };
      },
    });

    const { chunks, approvals } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Look up the status for query gamma.',
      tools: { lookup_status: lookup },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            content: 'Let me look that up for you.',
            toolCalls: [{ id: 'call_lookup_gamma', name: 'lookup_status', arguments: { query: 'gamma' } }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The status for gamma is STATUS_OK:gamma.' });
      },
    });

    expect(approvals).toEqual(['approve:call_lookup_gamma']);
    const approvalIndex = chunks.findIndex(chunk => chunk.type === 'tool-call-approval');
    const preambleIndex = chunks.findIndex(
      chunk => chunk.type === 'text-delta' && (chunk.payload as { text: string }).text.includes('Let me look'),
    );
    expect(preambleIndex).toBeGreaterThanOrEqual(0);
    expect(preambleIndex).toBeLessThan(approvalIndex);
    expect(executions).toBe(1);
    expect(textOf(chunks.slice(approvalIndex))).toContain('STATUS_OK:gamma');
  });

  // `onSuspended` is a durable stream option; the plain Agent reports suspension only through chunks.
  const itDurable = isDurableEngineVariant(engine) ? it : it.skip;
  itDurable('tells the onSuspended callback which tool call is waiting for approval', async () => {
    const shared = await createSharedAgent(getMock(), { engine, tools: { lookup_status: makeLookupTool() } });
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_lookup_delta', name: 'lookup_status', arguments: { query: 'delta' } }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'The status for delta is STATUS_OK:delta.' });
    const onSuspended = vi.fn((_data: AgentSuspendedEventData) => {});

    const run = (await shared.agent.stream('Look up the status for query delta.', {
      requireToolApproval: true,
      maxSteps: 5,
      onSuspended,
    })) as RunHandle;
    await drain(run, true);

    await vi.waitFor(() =>
      expect(onSuspended).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval',
          toolCallId: 'call_lookup_delta',
          toolName: 'lookup_status',
          args: { query: 'delta' },
        }),
      ),
    );

    const resumed = await drain(
      await shared.agent.approveToolCall({ runId: run.runId, toolCallId: 'call_lookup_delta' }),
      false,
    );
    expect(textOf(resumed)).toContain('STATUS_OK:delta');
  });

  it("asks for approval when the agent's default options require it and the call does not override", async () => {
    let executions = 0;
    const lookup = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        executions += 1;
        return { status: `STATUS_OK:${query}` };
      },
    });
    // The harness option type lists only the defaults other scenarios use; the agent accepts any stream option.
    const defaultOptions = { requireToolApproval: true } as RunLoopScenarioOptions['defaultOptions'];
    const shared = await createSharedAgent(getMock(), { engine, tools: { lookup_status: lookup }, defaultOptions });
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_lookup_eps', name: 'lookup_status', arguments: { query: 'epsilon' } }] },
    );
    getMock().on(
      { endpoint: 'chat', hasToolResult: true },
      { content: 'The status for epsilon is STATUS_OK:epsilon.' },
    );
    const durable = isDurableEngineVariant(engine);

    const run = (await shared.agent.stream('Look up the status for query epsilon.', { maxSteps: 5 })) as RunHandle;
    const firstChunks = await drain(run, durable);

    const approval = firstChunks.find(chunk => chunk.type === 'tool-call-approval');
    expect((approval?.payload as { toolCallId?: string } | undefined)?.toolCallId).toBe('call_lookup_eps');
    expect(executions).toBe(0);

    const resumed = await drain(
      await shared.agent.approveToolCall({ runId: run.runId, toolCallId: 'call_lookup_eps' }),
      false,
    );
    expect(executions).toBe(1);
    expect(textOf(resumed)).toContain('STATUS_OK:epsilon');
  });

  it('approving a tool call resumes without tripping an input processor that requires message history', async () => {
    const execute = vi.fn(async ({ name }: { name: string }) => ({ name, email: 'dero@example.com' }));
    const findUser = createTool({
      id: 'find_user',
      description: 'Returns the name and email of a user.',
      inputSchema: z.object({ name: z.string() }),
      requireApproval: true,
      execute,
    });
    const shared = await createSharedAgent(getMock(), {
      engine,
      tools: { find_user: findUser },
      inputProcessors: [new RequiresHistoryProcessor()],
      memory: new MockMemory(),
    });
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_find_user', name: 'find_user', arguments: { name: 'Dero Israel' } }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'User found: Dero Israel.' });
    const durable = isDurableEngineVariant(engine);

    const run = (await shared.agent.stream('Find the user named Dero Israel.', {
      requireToolApproval: true,
      maxSteps: 5,
    })) as RunHandle;
    const firstChunks = await drain(run, durable);
    expect(firstChunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);

    const resumed = await drain(
      await shared.agent.approveToolCall({ runId: run.runId, toolCallId: 'call_find_user' }),
      false,
    );

    expect(resumed.filter(chunk => chunk.type === 'tripwire')).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(textOf(resumed)).toContain('User found: Dero Israel.');
  });
});
