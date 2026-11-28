/**
 * A run started by one caller and approved by another: the model steps after the approved call are
 * offered the tools the approving caller would get. Each tool source below depends on the caller.
 * Whose context the approved call itself runs with is not asserted here.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Log = { offered: string[][]; ran: string[] };

function tool(id: string, log: Log, requireApproval = false) {
  return createTool({
    id,
    description: id,
    inputSchema: z.object({}),
    requireApproval,
    execute: async (_input, context) => {
      log.ran.push(`${id}:${context?.requestContext?.get('who')}`);
      return { ok: true };
    },
  });
}

function createModel(log: Log) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt, tools }) => {
      log.offered.push((tools ?? []).map(t => t.name).sort());
      const answered = prompt.some(message => message.role === 'tool');
      const parts = answered
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'approve', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function createRuntime(engine: 'default' | 'evented', storage: InMemoryStore, log: Log, recovery = false) {
  const approve = tool('approve', log, true);
  const secret = tool('secret', log);
  const agent = new Agent({
    id: 'matrix-agent',
    name: 'matrix-agent',
    instructions: 'Use your tools.',
    model: createModel(log),
    tools: ({ requestContext }) => {
      const who = requestContext.get('who') as string;
      return { approve, secret, [`${who}_agent`]: tool(`${who}_agent`, log) };
    },
    defaultOptions: ({ requestContext }) => {
      const who = requestContext.get('who') as string;
      return { toolsets: { defaults: { [`${who}_default`]: tool(`${who}_default`, log) } } };
    },
    inputProcessors: [
      {
        id: 'withhold-secret',
        processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => {
          const { secret: _secret, ...rest } = tools ?? {};
          return { tools: rest };
        },
      },
    ],
  });
  const durable =
    engine === 'evented'
      ? createEventedAgent({ agent })
      : createDurableAgent({ agent, ...(recovery ? { storageVersion: 1 as const } : {}) });
  new Mastra({
    agents: { matrix: durable as any },
    storage,
    logger: false,
    ...(recovery ? { recovery: { durableAgents: 'auto' as const } } : {}),
  });
  return durable;
}

function caller(who: string) {
  const requestContext = new RequestContext();
  requestContext.set('who', who);
  return requestContext;
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
}

describe.each(['default', 'evented'] as const)('resume by another caller (%s)', engine => {
  it.each([
    ['same process', true],
    ['same process', false],
    ['fresh process', true],
    ['fresh process', false],
  ] as const)(
    '%s, resume passes toolsets=%s: later steps offer the approving caller tools',
    async (path, resumeToolsets) => {
      globalRunRegistry.clear();
      const storage = new InMemoryStore();
      const log: Log = { offered: [], ran: [] };
      const starter = createRuntime(engine, storage, log);

      const stream = await starter.stream('Go', {
        requestContext: caller('alice'),
        toolsets: { start: { alice_call: tool('alice_call', log) } },
      });
      let toolCallId: string | undefined;
      for await (const chunk of stream.fullStream as AsyncIterable<any>) {
        if (chunk.type === 'tool-call-approval') {
          toolCallId = chunk.payload.toolCallId;
          break;
        }
      }
      expect(toolCallId).toBeTruthy();
      const workflows = (await storage.getStore('workflows'))!;
      await vi.waitFor(async () => {
        const run = await workflows.getWorkflowRunById({
          runId: stream.runId,
          workflowName: DurableStepIds.AGENTIC_LOOP,
        });
        expect((run?.snapshot as any)?.status).toBe('suspended');
      });
      expect(log.offered).toEqual([['alice_agent', 'alice_call', 'alice_default', 'approve']]);

      let approver = starter;
      if (path === 'fresh process') {
        globalRunRegistry.clear();
        approver = createRuntime(engine, storage, log);
      }
      await drain(
        await approver.approveToolCall({
          runId: stream.runId,
          toolCallId: toolCallId!,
          requestContext: caller('bob'),
          ...(resumeToolsets ? { toolsets: { resume: { bob_call: tool('bob_call', log) } } } : {}),
        }),
      );

      // Bob's agent and default tools, and the resume's own toolsets only, as a plain Agent resume
      // already offers. The starting call's toolsets are not carried over.
      expect(log.offered[1]).toEqual(['approve', 'bob_agent', ...(resumeToolsets ? ['bob_call'] : []), 'bob_default']);
    },
  );

  it('same process, resume passes nothing: later steps drop the starting call toolsets', async () => {
    globalRunRegistry.clear();
    const storage = new InMemoryStore();
    const log: Log = { offered: [], ran: [] };
    const agent = createRuntime(engine, storage, log);

    const stream = await agent.stream('Go', {
      requestContext: caller('alice'),
      toolsets: { start: { alice_call: tool('alice_call', log) } },
    });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBeTruthy();

    await drain(await agent.approveToolCall({ runId: stream.runId, toolCallId: toolCallId! }));

    expect(log.offered[1]).toEqual(['alice_agent', 'alice_default', 'approve']);
  });

  it('same process, resume passes only toolsets: later steps offer the resume toolsets', async () => {
    globalRunRegistry.clear();
    const storage = new InMemoryStore();
    const log: Log = { offered: [], ran: [] };
    const agent = createRuntime(engine, storage, log);

    const stream = await agent.stream('Go', {
      requestContext: caller('alice'),
      toolsets: { start: { alice_call: tool('alice_call', log) } },
    });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBeTruthy();

    // The same caller passes new toolsets without a new request context.
    await drain(
      await agent.approveToolCall({
        runId: stream.runId,
        toolCallId: toolCallId!,
        toolsets: { resume: { alice_more: tool('alice_more', log) } },
      }),
    );

    expect(log.offered[1]).toEqual(['alice_agent', 'alice_default', 'alice_more', 'approve']);
  });
});

describe('crash recovery, then resume by another caller', () => {
  it.each([true, false])('resume passes toolsets=%s', async resumeToolsets => {
    globalRunRegistry.clear();
    const log: Log = { offered: [], ran: [] };
    const original = new InMemoryStore();
    const workflows = (await original.getStore('workflows'))!;
    const rows = new Map<string, any>();
    let crashRows: any[] | undefined;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async args => {
      rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
      if (!crashRows && args.workflowName === DurableStepIds.AGENTIC_EXECUTION && args.snapshot.status === 'pending') {
        crashRows = [...rows.values()].map(row => structuredClone(row));
      }
      return persist(args);
    };
    const starter = createRuntime('default', original, log, true);
    // No call-time toolsets: recovery refuses runs started with them (#25860).
    const stream = await starter.stream('Go', { requestContext: caller('alice') });
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') break;
    }
    expect(crashRows?.length).toBeGreaterThan(0);

    // The crashed process is gone; a new one (its own module graph) recovers from what it left.
    log.offered = [];
    vi.resetModules();
    const [
      { Mastra: M },
      { InMemoryStore: Store },
      { Agent: A },
      { createDurableAgent: durableFor },
      { createTool: makeTool },
      { RequestContext: RC },
    ] = await Promise.all([
      import('../../../mastra'),
      import('../../../storage'),
      import('../../agent'),
      import('../create-durable-agent'),
      import('../../../tools'),
      import('../../../request-context'),
    ]);
    const freshTool = (id: string, requireApproval = false) =>
      makeTool({
        id,
        description: id,
        inputSchema: z.object({}),
        requireApproval,
        execute: async (_input: unknown, context: any) => {
          log.ran.push(`${id}:${context?.requestContext?.get('who')}`);
          return { ok: true };
        },
      });
    const approve = freshTool('approve', true);
    const secret = freshTool('secret');
    const recoveringAgent = new A({
      id: 'matrix-agent',
      name: 'matrix-agent',
      instructions: 'Use your tools.',
      model: createModel(log),
      tools: ({ requestContext }: any) => {
        const who = requestContext.get('who') as string;
        return { approve, secret, [`${who}_agent`]: freshTool(`${who}_agent`) };
      },
      defaultOptions: ({ requestContext }: any) => {
        const who = requestContext.get('who') as string;
        return { toolsets: { defaults: { [`${who}_default`]: freshTool(`${who}_default`) } } };
      },
      inputProcessors: [
        {
          id: 'withhold-secret',
          processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => {
            const { secret: _secret, ...rest } = tools ?? {};
            return { tools: rest };
          },
        },
      ],
    });
    const recovering = durableFor({ agent: recoveringAgent, storageVersion: 1 });
    const storage = new Store();
    new M({ agents: { matrix: recovering as any }, storage, logger: false, recovery: { durableAgents: 'auto' } });
    const recoveredWorkflows = (await storage.getStore('workflows'))!;
    for (const row of crashRows!) await recoveredWorkflows.persistWorkflowSnapshot(row);
    let toolCallId: string | undefined;
    for await (const chunk of (await recovering.recover(stream.runId)).fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBeTruthy();
    await vi.waitFor(async () => {
      const run = await recoveredWorkflows.getWorkflowRunById({
        runId: stream.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      expect((run?.snapshot as any)?.status).toBe('suspended');
    });
    expect(log.offered[0]).toEqual(['alice_agent', 'alice_default', 'approve']);

    const bob = new RC();
    bob.set('who', 'bob');
    await drain(
      await recovering.approveToolCall({
        runId: stream.runId,
        toolCallId: toolCallId!,
        requestContext: bob,
        ...(resumeToolsets ? { toolsets: { resume: { bob_call: freshTool('bob_call') } } } : {}),
      }),
    );
    expect(log.offered.at(-1)).toEqual([
      'approve',
      'bob_agent',
      ...(resumeToolsets ? ['bob_call'] : []),
      'bob_default',
    ]);
  });
});

describe.each(['default', 'evented'] as const)('a same-process resume whose tools cannot be built (%s)', engine => {
  it('fails it, and a later resume without a request context fails too', async () => {
    globalRunRegistry.clear();
    const log: Log = { offered: [], ran: [] };
    const agent = new Agent({
      id: 'matrix-agent',
      name: 'matrix-agent',
      instructions: 'Use your tools.',
      model: createModel(log),
      tools: ({ requestContext }) => {
        const who = requestContext.get('who') as string;
        if (who === 'unbuildable') throw new Error('tools unavailable');
        return { approve: tool('approve', log, true) };
      },
    });
    const durable = engine === 'evented' ? createEventedAgent({ agent }) : createDurableAgent({ agent });
    const storage = new InMemoryStore();
    new Mastra({ agents: { matrix: durable as any }, storage, logger: false });

    const stream = await durable.stream('Go', { requestContext: caller('alice') });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const run = await workflows.getWorkflowRunById({
        runId: stream.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      expect((run?.snapshot as any)?.status).toBe('suspended');
    });

    await expect(
      durable.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, requestContext: caller('unbuildable') }),
    ).rejects.toThrow('tools unavailable');

    const later = durable.approveToolCall({ runId: stream.runId, toolCallId: toolCallId! }).then(drain);
    await expect(later).rejects.toThrow('tools unavailable');
    expect(log.ran).toEqual([]);
  });
});
