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
import { ToolSearchProcessor } from '../../../processors/processors/tool-search';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

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
});
