import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { LanceStorage } from './index';

const dbPath = await fs.mkdtemp(path.join(os.tmpdir(), 'lance-parked-run-abort-'));

function chunks(parts: any[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function toolCallThenText() {
  let calls = 0;
  return new MastraLanguageModelV2Mock({
    doStream: async () => {
      calls++;
      const body =
        calls === 1
          ? [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'fetchRecord',
                input: '{}',
                providerExecuted: false,
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        stream: chunks([{ type: 'stream-start', warnings: [] }, ...body]) as any,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

afterAll(async () => {
  await fs.rm(dbPath, { recursive: true, force: true });
});

// LanceDB has no concurrent workflow updates and throws from `updateWorkflowState`, so the
// abort of a parked durable run must be persisted through its snapshot writes.
describe('aborting a parked durable run on LanceDB', () => {
  it('stops another server from approving the aborted tool call', async () => {
    const storage = await LanceStorage.create('lance-parked-run-abort', 'LanceParkedRunAbort', dbPath);
    const bus = new EventEmitter();
    let toolRuns = 0;
    const peer = () => {
      const agent = createDurableAgent({
        agent: new Agent({
          id: 'agent',
          name: 'Agent',
          instructions: 'Fetch records.',
          model: toolCallThenText(),
          tools: {
            fetchRecord: createTool({
              id: 'fetchRecord',
              description: 'Fetch a record',
              requireApproval: true,
              execute: async () => {
                toolRuns++;
                return { amount: 42 };
              },
            }),
          },
        }),
      });
      const mastra = new Mastra({ agents: { agent }, storage, pubsub: new EventEmitterPubSub(bus), logger: false });
      return { agent: mastra.getAgentById('agent') as typeof agent, mastra };
    };
    const executor = peer();
    const other = peer();

    try {
      let suspended = false;
      const { runId } = await executor.agent.stream('Fetch a record', {
        onSuspended: () => {
          suspended = true;
        },
      });
      const workflows = (await storage.getStore('workflows'))!;
      const status = () => workflows.loadWorkflowRunStatus({ workflowName: 'durable-agentic-loop', runId });
      await vi.waitFor(async () => {
        expect(suspended).toBe(true);
        expect(await status()).toBe('suspended');
      });

      await expect(executor.agent.__abortRunAcknowledged(runId)).resolves.toBe(true);
      expect(await status()).toBe('canceled');

      await expect(other.agent.approveToolCall({ runId, toolCallId: 'call-1' })).rejects.toMatchObject({
        id: 'AGENT_RESUME_ABORTED_RUN',
      });
      expect(toolRuns).toBe(0);
      expect(await status()).toBe('canceled');
    } finally {
      await executor.mastra.shutdown();
      await other.mastra.shutdown();
    }
  }, 60_000);
});
