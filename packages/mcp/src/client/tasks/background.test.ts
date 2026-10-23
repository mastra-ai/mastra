import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';
import { MockStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';
import { startTasksFixtureServer } from '../../__fixtures__/tasks-server';
import type { TasksFixtureServer } from '../../__fixtures__/tasks-server';
import { MCPClient } from '../configuration';

/**
 * An agent with background tasks enabled must not sit blocked on a remote MCP task: the tool call runs
 * as a background task, the agent takes its next turn while the remote task is still working, and the
 * remote result reaches the model once the task completes.
 */
describe('MCP tasks as agent background tasks', () => {
  let server: TasksFixtureServer;
  let mcp: MCPClient;
  let mastra: Mastra;

  afterEach(async () => {
    await mastra?.backgroundTaskManager?.shutdown();
    await mcp?.disconnect().catch(() => {});
    await server?.close();
  });

  /** Model calls `reports_gated` on turn 1; `onSecondTurn` runs while turn 2 is being generated. */
  async function runAgent(onSecondTurn: (remoteTaskId: string) => Promise<void>) {
    server = await startTasksFixtureServer();
    mcp = new MCPClient({ id: `tasks-bg-${Math.random()}`, servers: { reports: { url: server.url, tasks: true } } });
    mastra = new Mastra({ logger: false, storage: new MockStore(), backgroundTasks: { enabled: true } });

    const prompts: unknown[] = [];
    let turn = 0;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        turn++;
        if (turn === 2) await onSecondTurn(await waitForTaskId(server));
        const parts =
          turn === 1
            ? [
                { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'reports_gated', input: '{}' },
                { type: 'finish' as const, finishReason: 'tool-calls' as const, usage: usage() },
              ]
            : [
                { type: 'text-start' as const, id: 't' },
                { type: 'text-delta' as const, id: 't', delta: 'ok' },
                { type: 'text-end' as const, id: 't' },
                { type: 'finish' as const, finishReason: 'stop' as const, usage: usage() },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: `s${turn}`, modelId: 'mock', timestamp: new Date(0) },
            ...parts,
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'tasks-agent',
      name: 'tasks-agent',
      instructions: 'Use the tools.',
      model,
      tools: await mcp.listTools(),
      memory: new MockMemory(),
    });
    mastra.addAgent(agent, 'tasks-agent');

    const result = await agent.streamUntilIdle('Run the gated job.', {
      memory: { thread: 'thread-tasks', resource: 'user-1' },
      maxSteps: 5,
    });
    const reader = (result.fullStream as ReadableStream<unknown>).getReader();
    while (!(await reader.read()).done) {}
    return { prompts };
  }

  it('keeps the agent working while the remote task runs, then delivers its result', async () => {
    const statusDuringTurn: (string | undefined)[] = [];

    const { prompts } = await runAgent(async taskId => {
      // The agent took another turn without waiting on the tool; the remote task is still open.
      statusDuringTurn.push((await server.store.get(taskId, { principal: 'anonymous' }))?.status);
      server.release();
    });

    expect(statusDuringTurn).toEqual(['working']);
    expect(JSON.stringify(prompts.slice(2))).toContain('released');
    expect(server.runs.gated).toBe(1);
    expect(server.requests.filter(request => request.method === 'tools/call')).toHaveLength(1);
  });

  it('cancels the remote task when the background task is cancelled', async () => {
    let remoteTaskId = '';

    await runAgent(async taskId => {
      remoteTaskId = taskId;
      const { tasks } = await mastra.backgroundTaskManager!.listTasks({ toolCallId: 'call-1' });
      await mastra.backgroundTaskManager!.cancel(tasks[0]!.id);
    });

    await waitUntil(() => server.requests.some(request => request.method === 'tasks/cancel'));
    expect(server.requests.find(request => request.method === 'tasks/cancel')!.params.taskId).toBe(remoteTaskId);
    expect((await server.store.get(remoteTaskId, { principal: 'anonymous' }))?.status).toBe('cancelled');
  });
});

async function waitUntil(condition: () => boolean, timeoutMs = 2_000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition not met');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

async function waitForTaskId(server: TasksFixtureServer): Promise<string> {
  await waitUntil(() => server.requests.some(request => request.method === 'tasks/get'));
  return server.requests.find(request => request.method === 'tasks/get')!.params.taskId as string;
}

const usage = () => ({ inputTokens: 1, outputTokens: 1, totalTokens: 2 });
