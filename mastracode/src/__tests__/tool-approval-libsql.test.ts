import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';

vi.setConfig({ testTimeout: 30_000 });

function createToolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'readFile',
        input: '{"path":"test.txt"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-1',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'File contents here' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

describe('tool approval with LibSQLStore via Harness', () => {
  it('should persist and load snapshot for tool approval resume', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ content: 'file contents' });

    const readFileTool = createTool({
      id: 'readFile',
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      execute: async input => mockExecute(input),
    });

    const storage = new LibSQLStore({
      id: 'test-store',
      url: 'file::memory:?cache=shared',
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You read files.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }) as any,
      tools: { readFile: readFileTool },
    });

    const mastra = new Mastra({
      agents: { 'test-agent': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent');

    const harness = new Harness({
      id: 'test-harness',
      storage,
      modes: [
        {
          id: 'default',
          name: 'Default',
          description: 'default',
          defaultModelId: 'test',
          metadata: {
            default: true,
          },
          instructions: 'You read files.',
        },
      ],
      initialState: { yolo: false },
    });
    (harness as any).getAgentForMode = () => registeredAgent;

    await harness.init();

    // Collect events
    const events: any[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    // Create a thread
    await harness.session.thread.create();

    // Send message — should hit tool-call-approval and auto-approve (policy = 'ask')
    // We need to respond to the approval prompt
    const approvalPromise = new Promise<void>(resolve => {
      harness.session.subscribe(event => {
        if (event.type === 'tool_approval_required') {
          // Must be async — the approval gate is armed after emit returns
          queueMicrotask(() => {
            harness.session.respondToToolApproval({ decision: 'approve' });
            resolve();
          });
        }
      });
    });

    await Promise.all([harness.sendMessage({ content: 'Read test.txt' }), approvalPromise]);

    // The tool should have been called
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
