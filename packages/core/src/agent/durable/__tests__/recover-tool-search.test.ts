/**
 * #26437: a tool loaded by ToolSearchProcessor mid-run must be available after
 * `recover()` in a fresh process. The fresh processor has no in-memory record of
 * the load, so recovery reads it from the run's transcript, which the nested
 * execution workflow persists under `snapshot.value.messageListState`.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { ToolSearchProcessor } from '../../../processors/processors/tool-search';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { consumeText, createGate, createRestartScenario } from './restart-harness';

const findOrder = createTool({
  id: 'find-order',
  description: 'Find an order by id',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async () => ({ status: 'shipped' }),
});

function transcript() {
  const list = new MessageList({ threadId: 't', resourceId: 'r' });
  list.add({ role: 'user', content: 'Where is ORD-1?' }, 'input');
  list.add(
    {
      id: 'a1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'c1',
              toolName: 'search_tools',
              args: { query: 'find order' },
              result: { loaded: ['find-order'] },
            },
          },
        ],
      },
    },
    'response',
  );
  return list.serialize();
}

function snapshot(runId: string, value: Record<string, unknown> = {}): WorkflowRunState {
  return {
    runId,
    status: 'running',
    value,
    context: {
      input: {
        __workflowKind: 'durable-agent',
        runId,
        agentId: 'search-agent',
        messageListState: { memoryInfo: { threadId: 't', resourceId: 'r' } },
        requestContextEntries: {},
        modelConfig: { provider: 'mock', modelId: 'mock-v1' },
        state: { threadId: 't', resourceId: 'r' },
      } as any,
    },
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
  } as WorkflowRunState;
}

describe('DurableAgent.recover() with ToolSearchProcessor (#26437)', () => {
  it.each(['durable', 'evented'] as const)(
    'replays an interrupted search-loaded tool with its original call id on %s (#28171)',
    async kind => {
      const gate = createGate();
      const calls: { generation: number; toolCallId: string | undefined }[] = [];
      const resultsSeen: unknown[] = [];
      const scenario = createRestartScenario({
        kind,
        runId: `search-recovery-${kind}`,
        build: ({ core, generation }) => {
          const stamp = core.createTool({
            id: 'stamp',
            description: 'Stamp a marker',
            inputSchema: z.object({ marker: z.string() }),
            execute: async ({ marker }, context) => {
              calls.push({ generation, toolCallId: context?.agent?.toolCallId });
              if (generation === 1) await gate.wait();
              return { stamped: marker };
            },
          });
          return new core.Agent({
            id: 'searched',
            name: 'searched',
            instructions: 'Search for stamp, stamp m1, then answer done.',
            inputProcessors: [new ToolSearchProcessor({ tools: { stamp }, search: { autoLoad: true } })],
            model: new MockLanguageModelV2({
              doStream: async ({ prompt }) => {
                const results = prompt.flatMap(message =>
                  Array.isArray(message.content) ? message.content.filter(part => part.type === 'tool-result') : [],
                );
                const stampResult = results.find(part => part.toolName === 'stamp');
                if (generation > 1 && stampResult) resultsSeen.push(stampResult);
                const next = !results.some(part => part.toolName === 'search_tools')
                  ? { toolName: 'search_tools', toolCallId: 'search-1', input: '{"query":"stamp"}' }
                  : !stampResult
                    ? { toolName: 'stamp', toolCallId: 'stamp-2', input: '{"marker":"m1"}' }
                    : undefined;
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    ...(next
                      ? [{ type: 'tool-call' as const, ...next }]
                      : [
                          { type: 'text-start' as const, id: 'text' },
                          { type: 'text-delta' as const, id: 'text', delta: 'done' },
                          { type: 'text-end' as const, id: 'text' },
                        ]),
                    {
                      type: 'finish',
                      finishReason: next ? 'tool-calls' : 'stop',
                      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                    },
                  ]),
                };
              },
            }),
          });
        },
      });
      let originalText: Promise<string> | undefined;
      try {
        const original = await scenario.start(async ({ agent, runId }) => {
          originalText = consumeText(await agent.stream('stamp m1', { runId }));
          return originalText;
        });
        await gate.reached;
        const recovered = await scenario.restart(await original.checkpoint());
        expect(recovered.executionError).toBeUndefined();
        expect(recovered.streamErrors).toEqual([]);
        expect(recovered.text).toBe('done');
        expect(resultsSeen).toEqual([
          expect.objectContaining({
            toolCallId: 'stamp-2',
            toolName: 'stamp',
            output: { type: 'json', value: { stamped: 'm1' } },
          }),
        ]);
        expect(calls).toEqual([
          { generation: 1, toolCallId: 'stamp-2' },
          { generation: 2, toolCallId: 'stamp-2' },
        ]);
      } finally {
        gate.release();
        await originalText;
        await scenario.stop();
      }
    },
  );

  it('restores tools the processor loaded during the run', async () => {
    const store = new InMemoryStore();
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'search-agent',
        name: 'search-agent',
        instructions: 'x',
        model: new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([]),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }) as any,
        inputProcessors: [new ToolSearchProcessor({ tools: { 'find-order': findOrder } })],
      }),
    });
    void new Mastra({ agents: { 'search-agent': agent as any }, storage: store });

    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId: 'run-1',
      resourceId: 'r',
      snapshot: snapshot('run-1'),
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_EXECUTION,
      runId: 'run-1',
      resourceId: 'r',
      snapshot: snapshot('run-1', { messageListState: transcript() }),
    });

    const restart = vi.fn(async () => ({ status: 'success' }));
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn(async ({ runId }: { runId: string }) => ({ restart, runId })),
      restart,
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);

    const { cleanup } = await agent.recover('run-1');
    expect(Object.keys(globalRunRegistry.get('run-1')?.tools ?? {})).toContain('find-order');
    cleanup();
  });

  it('restores tools loaded by a search result the checkpoint keeps as a memory ref', async () => {
    const store = new InMemoryStore();
    const memory = new MockMemory({ storage: store });
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'search-agent',
        name: 'search-agent',
        instructions: 'x',
        model: new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([]),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }) as any,
        memory,
        inputProcessors: [new ToolSearchProcessor({ tools: { 'find-order': findOrder } })],
      }),
    });
    void new Mastra({ agents: { 'search-agent': agent as any }, storage: store });

    // The run saved the search result to memory, so its checkpoint holds a ref.
    const state = transcript();
    const saved = state.messages.find(message => message.id === 'a1')!;
    await memory.createThread({ threadId: 't', resourceId: 'r' });
    await memory.saveMessages({ messages: [{ ...saved, threadId: 't', resourceId: 'r' } as any] });
    const checkpoint = {
      ...state,
      messages: state.messages.map(message =>
        message.id === 'a1' ? { __ref: 'memory', id: 'a1', fingerprint: 'stale' } : message,
      ),
    };

    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId: 'run-2',
      resourceId: 'r',
      snapshot: snapshot('run-2'),
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_EXECUTION,
      runId: 'run-2',
      resourceId: 'r',
      snapshot: snapshot('run-2', { messageListState: checkpoint }),
    });

    const restart = vi.fn(async () => ({ status: 'success' }));
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn(async ({ runId }: { runId: string }) => ({ restart, runId })),
      restart,
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);

    const { cleanup } = await agent.recover('run-2');
    expect(Object.keys(globalRunRegistry.get('run-2')?.tools ?? {})).toContain('find-order');
    cleanup();
  });
});
