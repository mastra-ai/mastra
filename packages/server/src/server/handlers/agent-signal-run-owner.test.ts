import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import { QUEUE_AGENT_MESSAGE_ROUTE, SEND_AGENT_MESSAGE_ROUTE, SEND_AGENT_SIGNAL_ROUTE } from './agents';

const OWNER = 'alice';
const OTHER = 'mallory';

function textChunks(text: string) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ] as any[];
}

async function setup() {
  const prompts: string[] = [];
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  let calls = 0;
  const model = {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'test-model',
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('not used');
    },
    doStream: async ({ prompt }: { prompt: unknown }) => {
      calls += 1;
      prompts.push(JSON.stringify(prompt));
      if (calls === 1) await released;
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of textChunks('ok')) controller.enqueue(chunk);
            controller.close();
          },
        }),
      };
    },
  } as any;
  const memory = new MockMemory();
  const agent = new Agent({ id: 'guarded', name: 'guarded', instructions: 'test', model, memory });
  const mastra = new Mastra({ agents: { guarded: agent }, logger: false });
  const threadId = 'owner-thread';
  await memory.createThread({ threadId, resourceId: OWNER });
  const subscription = await agent.subscribeToThread({ threadId, resourceId: OWNER });
  const stream = await agent.stream('owner starts', { memory: { thread: threadId, resource: OWNER } });
  for (let i = 0; i < 200 && prompts.length === 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
  return { mastra, memory, prompts, release, stream, subscription, threadId };
}

function callerContext(resourceId: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return requestContext;
}

async function expectAccessDenied(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HTTPException);
  expect((error as HTTPException).status).toBe(403);
  expect((error as HTTPException).message).toBe('Access denied: thread belongs to a different resource');
}

describe('signal and message routes with only a runId', () => {
  it.each([
    {
      name: 'signals',
      call: (mastra: Mastra, runId: string) =>
        SEND_AGENT_SIGNAL_ROUTE.handler({
          mastra,
          agentId: 'guarded',
          requestContext: callerContext(OTHER),
          runId,
          signal: { type: 'user-message', contents: 'INJECTED' },
        } as any),
    },
    {
      name: 'send-message',
      call: (mastra: Mastra, runId: string) =>
        SEND_AGENT_MESSAGE_ROUTE.handler({
          mastra,
          agentId: 'guarded',
          requestContext: callerContext(OTHER),
          runId,
          message: 'INJECTED',
        } as any),
    },
    {
      name: 'queue-message',
      call: (mastra: Mastra, runId: string) =>
        QUEUE_AGENT_MESSAGE_ROUTE.handler({
          mastra,
          agentId: 'guarded',
          requestContext: callerContext(OTHER),
          runId,
          message: 'INJECTED',
          ifActive: { behavior: 'persist' },
        } as any),
    },
  ])('$name rejects a caller whose resource does not own the run', async ({ call }) => {
    const { mastra, memory, prompts, release, stream, subscription, threadId } = await setup();
    try {
      await expectAccessDenied(call(mastra, stream.runId));
    } finally {
      release();
    }
    await stream.text;
    await new Promise(resolve => setTimeout(resolve, 0));
    subscription.unsubscribe();
    expect(prompts.join('\n')).not.toContain('INJECTED');
    const { messages } = await memory.recall({ threadId, hideSignals: false });
    expect(JSON.stringify(messages)).not.toContain('INJECTED');
  });

  it('accepts input from the caller whose resource owns the run', async () => {
    const { mastra, memory, prompts, release, stream, subscription, threadId } = await setup();
    try {
      await SEND_AGENT_MESSAGE_ROUTE.handler({
        mastra,
        agentId: 'guarded',
        requestContext: callerContext(OWNER),
        runId: stream.runId,
        message: 'FROM_OWNER',
      } as any);
    } finally {
      release();
    }
    await stream.text;
    for (let i = 0; i < 200 && !prompts.join('\n').includes('FROM_OWNER'); i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    subscription.unsubscribe();
    expect(prompts.join('\n')).toContain('FROM_OWNER');
    const { messages } = await memory.recall({ threadId, hideSignals: false });
    expect(JSON.stringify(messages)).toContain('FROM_OWNER');
  });
});
