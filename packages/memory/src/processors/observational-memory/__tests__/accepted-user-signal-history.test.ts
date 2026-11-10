import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

// A single agent with observational memory, as Factory and MastraCode run it. A chat sends each
// message as a `user` signal; a reloaded chat rebuilds its transcript from stored history, so a
// message must be stored while the agent still works on it.

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Step = { text: string } | { tool: string } | { error: string };

function observerModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 'obs' },
        { type: 'text-delta' as const, id: 'obs', delta: '<observations>none</observations>' },
        { type: 'text-end' as const, id: 'obs' },
        { type: 'finish' as const, finishReason: 'stop' as const, usage },
      ]),
    }),
  });
}

/** Answers each model request with the next step; `hold` keeps request `n` open until released. */
function scriptedModel(steps: Step[], hold?: number) {
  const reached = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async (options: any) => {
      const index = prompts.length;
      prompts.push(JSON.stringify(options.prompt));
      const step = steps[Math.min(index, steps.length - 1)]!;
      if ('error' in step) throw new Error(step.error);
      if (index === hold) reached.resolve();
      return {
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            if ('tool' in step) {
              controller.enqueue({ type: 'tool-call', toolCallId: `call-${index}`, toolName: step.tool, input: '{}' });
              controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
            } else {
              controller.enqueue({ type: 'text-start', id: `text-${index}` });
              controller.enqueue({ type: 'text-delta', id: `text-${index}`, delta: step.text });
              if (index === hold) await released.promise;
              controller.enqueue({ type: 'text-end', id: `text-${index}` });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
            }
            controller.close();
          },
        }),
      };
    },
  });
  return { model, prompts, reached: reached.promise, release: released.resolve };
}

function setup(model: MockLanguageModelV2, tools: Record<string, ReturnType<typeof createTool>> = {}) {
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: { model: observerModel() },
        reflection: { model: observerModel() },
      },
    },
  });
  const agent = new Agent({ id: 'om-agent', name: 'om agent', instructions: 'Reply.', memory, model, tools });
  new Mastra({ agents: { omAgent: agent }, logger: false, storage });
  const thread = { resourceId: 'om-user', threadId: `om-thread-${Math.random().toString(36).slice(2)}` };
  const stored = async () => (await memory.recall({ threadId: thread.threadId })).messages;
  return { agent, memory, thread, stored };
}

const sentTexts = (messages: MastraDBMessage[]) =>
  messages
    .filter(message => message.role === 'signal')
    .map(message => message.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''));

const answers = (messages: MastraDBMessage[]) =>
  messages
    .filter(message => message.role === 'assistant')
    .map(message => ({ id: message.id, parts: message.content.parts }));

async function finish(accepted: Promise<any>) {
  const run = await accepted;
  expect(run.action).toBe('wake');
  const chunks: any[] = [];
  for await (const chunk of run.output.fullStream) chunks.push(chunk);
  return chunks;
}

describe('observational memory and messages a person sends', () => {
  it('stores the message while its first model call runs, and keeps one row after the turn', async () => {
    const { model, reached, release } = scriptedModel([{ text: 'on it' }], 0);
    const { agent, memory, thread, stored } = setup(model);
    await memory.createThread(thread);

    const { signal, accepted } = agent.sendSignal(
      { type: 'user-message', contents: 'build the login page' },
      { ...thread, ifIdle: { behavior: 'wake' } },
    );
    await reached;

    expect((await stored()).map(message => [message.role, message.id])).toEqual([['signal', signal.id]]);

    release();
    await finish(accepted);

    const afterTurn = await stored();
    expect(afterTurn.filter(message => message.id === signal.id)).toHaveLength(1);
    expect(afterTurn.map(message => message.role).sort()).toEqual(['assistant', 'signal']);
  });

  it('stores a message sent right after the first with the request it joins', async () => {
    const { model, prompts, reached, release } = scriptedModel([{ text: 'on it' }], 0);
    const { agent, memory, thread, stored } = setup(model);
    await memory.createThread(thread);

    const first = agent.sendMessage({ contents: 'build the login page' }, thread);
    const second = agent.sendMessage({ contents: 'use the existing button' }, thread);
    expect(await second.accepted).toMatchObject({ action: 'deliver' });
    await reached;

    expect(prompts[0]).toContain('use the existing button');
    expect(sentTexts(await stored())).toEqual(['build the login page', 'use the existing button']);

    release();
    await finish(first.accepted);
    expect(sentTexts(await stored())).toEqual(['build the login page', 'use the existing button']);
  });

  // Observational memory already saved this follow-up when the next step started; the early save
  // must keep that.
  it('stores a message sent while a tool runs before the request that takes it in', async () => {
    let followUp: { accepted: Promise<unknown> } | undefined;
    let agentRef: Agent | undefined;
    const { model, prompts, reached, release } = scriptedModel([{ tool: 'clone' }, { text: 'done' }], 1);
    const clone = createTool({
      id: 'clone',
      description: 'Clones the repository',
      inputSchema: z.object({}),
      execute: async () => {
        followUp = agentRef!.sendMessage({ contents: 'also add a forgot-password link' }, thread);
        await followUp.accepted;
        return { cloned: true };
      },
    });
    const { agent, memory, thread, stored } = setup(model, { clone });
    agentRef = agent;
    await memory.createThread(thread);

    const sent = agent.sendMessage({ contents: 'build the login page' }, thread);
    await reached;

    expect(prompts[1]).toContain('also add a forgot-password link');
    expect(sentTexts(await stored())).toEqual(['build the login page', 'also add a forgot-password link']);

    release();
    await finish(sent.accepted);
    expect(await followUp!.accepted).toMatchObject({ action: 'deliver' });
  });

  // Already the case before the early save; it must not drop the message on a failed run.
  it('keeps the message when the model call fails, so the chat can show the error next to it', async () => {
    const { model } = scriptedModel([{ error: 'provider unavailable' }]);
    const { agent, memory, thread, stored } = setup(model);
    await memory.createThread(thread);

    const chunks = await finish(agent.sendMessage({ contents: 'build the login page' }, thread).accepted);

    expect(JSON.stringify(chunks.filter(chunk => chunk.type === 'error'))).toContain('provider unavailable');
    expect(sentTexts(await stored())).toEqual(['build the login page']);
  });

  it('stores the next turn early too, without touching the previous one', async () => {
    const { model, reached, release } = scriptedModel([{ text: 'first answer' }, { text: 'second answer' }], 1);
    const { agent, memory, thread, stored } = setup(model);
    await memory.createThread(thread);

    await finish(agent.sendMessage({ contents: 'build the login page' }, thread).accepted);
    const previousAnswer = answers(await stored());
    expect(previousAnswer).toHaveLength(1);
    const second = agent.sendMessage({ contents: 'now add tests' }, thread);
    await reached;

    const during = await stored();
    expect(sentTexts(during)).toEqual(['build the login page', 'now add tests']);
    expect(answers(during)).toEqual(previousAnswer);

    release();
    await finish(second.accepted);
    expect(sentTexts(await stored())).toEqual(['build the login page', 'now add tests']);
  });

  it('leaves storage to the Mastra gateway when it runs observational memory', async () => {
    const { model } = scriptedModel([{ text: 'on it' }]);
    const { agent, memory, thread, stored } = setup(Object.assign(model, { gatewayId: 'mastra' }));
    await memory.createThread(thread);

    await finish(agent.sendMessage({ contents: 'build the login page' }, thread).accepted);

    expect(await stored()).toEqual([]);
  });
});
