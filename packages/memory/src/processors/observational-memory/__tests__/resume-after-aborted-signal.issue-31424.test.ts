import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

// First call asks a question through a suspending tool; every later call answers.
function createAskThenAnswerModel() {
  const model = {
    calls: 0,
    specificationVersion: 'v4' as const,
    provider: 'mock',
    modelId: 'mock',
    supportedUrls: {},
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: 'unused' }],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage,
      warnings: [],
    }),
    doStream: async () => {
      model.calls += 1;
      const parts =
        model.calls === 1
          ? [
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'ask',
                input: JSON.stringify({ question: 'Left or right?' }),
              },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Noted.' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
  return model;
}

const question = z.object({ question: z.string() });
const answer = z.object({ answer: z.string() });

describe('Resuming a suspended durable run after its first request was aborted (#31424)', () => {
  let mastra: Mastra | undefined;
  afterEach(async () => {
    await mastra?.stopWorkers();
    mastra = undefined;
  });

  async function run(abortFirst: boolean) {
    const model = createAskThenAnswerModel();
    const observerModel = createAskThenAnswerModel();
    const firstRequest = new AbortController();
    const storage = new InMemoryStore();
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'resume-after-abort',
        name: 'Resume after abort',
        instructions: 'Ask, then acknowledge.',
        model: model as any,
        memory: new Memory({ storage, options: { observationalMemory: { model: observerModel as any } } }),
        tools: {
          ask: createTool({
            id: 'ask',
            description: 'Ask the user a question.',
            inputSchema: question,
            suspendSchema: question,
            resumeSchema: answer,
            outputSchema: answer,
            execute: async (input, context) => {
              const { resumeData, suspend } = context.agent ?? {};
              return resumeData ?? (await suspend!(input));
            },
          }),
        },
      }),
    });
    mastra = new Mastra({ storage, agents: { agent }, logger: false });

    const memory = { thread: 'thread-1', resource: 'user-1' };
    const first = await agent.stream('Ask me which side.', {
      memory,
      abortSignal: firstRequest.signal,
      closeOnSuspend: true,
    });
    await first.output.consumeStream();
    expect(await first.output.finishReason).toBe('suspended');
    // The first HTTP request ends once the run suspends, and its signal is aborted with it.
    if (abortFirst) firstRequest.abort();

    const resumed = await agent.resumeStream(
      { answer: 'Right' },
      { runId: first.runId, toolCallId: 'call-1', memory, abortSignal: new AbortController().signal },
    );
    const tripwires: { processorId?: string; reason?: string }[] = [];
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'tripwire') tripwires.push(chunk.payload);
    }
    return { tripwires, text: await resumed.text, modelCalls: model.calls, observerCalls: observerModel.calls };
  }

  it('resumes after the first request was aborted', async () => {
    const result = await run(true);

    expect(result.tripwires).toEqual([]);
    expect(result.text).toBe('Noted.');
    expect(result.modelCalls).toBe(2);
    expect(result.observerCalls).toBe(0);
  });

  it('resumes while the first request is still open', async () => {
    const result = await run(false);

    expect(result.tripwires).toEqual([]);
    expect(result.text).toBe('Noted.');
    expect(result.modelCalls).toBe(2);
    expect(result.observerCalls).toBe(0);
  });
});
