import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../../request-context';
import { MockStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * A stored version runs on a fork of the registered agent, but the `untilIdle` stream that
 * waits for its deferred tasks belongs to the registered agent. When such a task finishes,
 * that stream reports it with its own follow-up turn, so the fork must not also send the
 * thread a `background-task` signal: that would report the same task twice. (#28986)
 */
describe('a deferred task finished under a version fork', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.backgroundTaskManager?.shutdown();
  });

  // Turn 1 calls the tool; every later turn answers, so the run goes idle.
  function model() {
    let call = 0;
    return new MockLanguageModelV2({
      doStream: async () => {
        call++;
        const parts: any[] =
          call === 1
            ? [
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'research', input: '{"topic":"otters"}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `s${call}`, modelId: 'mock', timestamp: new Date(0) },
            ...parts,
          ]),
        };
      },
    });
  }

  it('leaves the report to the untilIdle stream instead of also signalling the thread', async () => {
    const agent = new Agent({
      id: 'versioned-bg-agent',
      name: 'versioned-bg-agent',
      instructions: 'Use the research tool.',
      model: model(),
      tools: {
        research: createTool({
          id: 'research',
          description: 'Research a topic.',
          inputSchema: z.object({ topic: z.string() }),
          execute: async ({ topic }) => ({ summary: `Research on ${topic}` }),
          background: { enabled: true },
        }),
      },
      memory: new MockMemory(),
    });
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { agent },
      backgroundTasks: { enabled: true },
    });

    const forks: Agent[] = [];
    vi.spyOn(mastra, 'getEditor').mockReturnValue({
      agent: {
        applyStoredOverrides: async (root: Agent) => {
          const fork = root.__fork();
          forks.push(fork);
          return fork;
        },
      },
    } as any);
    const signalled: unknown[] = [];
    const recordSignals = (target: Agent) =>
      vi.spyOn(target, 'sendSignal').mockImplementation(((signal: unknown) => {
        signalled.push(signal);
        return { accepted: Promise.resolve(), runId: 'none' };
      }) as any);
    recordSignals(agent);
    const originalFork = agent.__fork.bind(agent);
    vi.spyOn(agent, '__fork').mockImplementation(() => {
      const fork = originalFork();
      recordSignals(fork);
      return fork;
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-bg-agent': { status: 'published' } } });
    const result = await agent.streamUntilIdle('Research otters.', {
      memory: { thread: 'thread-version-bg', resource: 'user-1' },
      requestContext,
      maxSteps: 5,
    });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream as AsyncIterable<any>) chunks.push(chunk);

    expect(forks).not.toHaveLength(0);
    expect(chunks.some(c => c.type === 'background-task-completed')).toBe(true);
    // The notification is sent from the task's completion hook, before the stream sees the completion.
    expect(signalled).toEqual([]);
  });
});
