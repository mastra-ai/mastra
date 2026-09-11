import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression test for approving a tool inside a background sub-agent.
 *
 * The sub-agent pauses on a `requireApproval` tool. Agent-as-tool relays that pause with the
 * sub-agent's run id in `suspendOptions.runId`; the suspend payload itself carries no run id.
 * The background-task workflow only restores `suspendedToolRunId` from its suspend payload, so on
 * `manager.resume(taskId, { approved: true })` the delegation had no run to resume, started the
 * sub-agent over, and the approved tool never ran.
 */
describe('sub-agent background approval', () => {
  const storage = new MockStore();
  let mastra: Mastra;

  beforeEach(async () => {
    mastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    await mastra.startWorkers();
  });

  afterEach(async () => {
    await mastra.backgroundTaskManager?.shutdown();
    await mastra.stopWorkers();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  const finish = (finishReason: 'stop' | 'tool-calls') => ({
    type: 'finish' as const,
    finishReason,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  });

  const toolCallTurn = (toolCallId: string, toolName: string, args: Record<string, unknown>) => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'tool-call' as const, toolCallId, toolName, input: JSON.stringify(args) },
      finish('tool-calls'),
    ]),
  });

  const textTurn = (text: string) => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 't' },
      { type: 'text-delta' as const, id: 't', delta: text },
      { type: 'text-end' as const, id: 't' },
      finish('stop'),
    ]),
  });

  const hasToolResult = (prompt: any[]) => prompt.some(message => message?.role === 'tool');

  it('runs the approved tool when the owner approves the background sub-agent', async () => {
    const bookings: string[] = [];
    const book = createTool({
      id: 'book',
      description: 'Book a slot.',
      inputSchema: z.object({ slot: z.string() }),
      requireApproval: true,
      execute: async ({ slot }) => {
        bookings.push(slot);
        return { booked: slot };
      },
    });

    const helper = new Agent({
      id: 'helper',
      name: 'helper',
      description: 'Books slots.',
      instructions: 'Book the slot you are asked for.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }: any) =>
          hasToolResult(prompt) ? textTurn('Booked.') : toolCallTurn('book-1', 'book', { slot: '12:45' }),
      }),
      tools: { book },
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate bookings to the helper.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }: any) =>
          hasToolResult(prompt)
            ? textTurn('On it.')
            : toolCallTurn('call-1', 'agent-helper', { prompt: 'Book 12:45.' }),
      }),
      agents: { helper },
      backgroundTasks: { tools: { helper: { enabled: true } } },
    });
    mastra.addAgent(supervisor, 'supervisor');

    const stream = await supervisor.streamUntilIdle('Book 12:45.', { maxSteps: 3 });
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);

    const taskId = chunks.find(c => c.type === 'background-task-started')?.payload.taskId as string;
    const manager = mastra.backgroundTaskManager!;
    await vi.waitFor(async () => expect((await manager.getTask(taskId))?.status).toBe('suspended'), {
      timeout: 2000,
    });
    expect(bookings).toEqual([]);

    await manager.resume(taskId, { approved: true });

    await vi.waitFor(async () => expect((await manager.getTask(taskId))?.status).toBe('completed'), {
      timeout: 2000,
    });
    expect(bookings).toEqual(['12:45']);
  });
});
