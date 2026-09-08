import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { STREAM_AGENT_CONTROLLER_SESSION_ROUTE } from './agent-controller';

interface WireEvent {
  type: string;
}

function isWireEvent(value: unknown): value is WireEvent {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
}

function isMessageEvent(event: WireEvent): boolean {
  return event.type.startsWith('message_');
}

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => {
    open = resolve;
  });
  return { opened, open };
}
type Gate = ReturnType<typeof gate>;

async function openSessionStream(mastra: Mastra): Promise<ReadableStreamDefaultReader<unknown>> {
  const stream = await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
    mastra,
    controllerId: 'code',
    resourceId: 'mid-run',
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  });
  if (!(stream instanceof ReadableStream)) throw new Error('Expected a session stream');
  return stream.getReader();
}

async function readUntil(
  reader: ReadableStreamDefaultReader<unknown>,
  matches: (event: WireEvent) => boolean,
): Promise<WireEvent[]> {
  const events: WireEvent[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) return events;
    if (!isWireEvent(value)) continue;
    events.push(value);
    if (matches(value)) return events;
  }
}

async function readFor(reader: ReadableStreamDefaultReader<unknown>, ms: number): Promise<WireEvent[]> {
  const events: WireEvent[] = [];
  const deadline = new Promise<'deadline'>(resolve => setTimeout(() => resolve('deadline'), ms));
  while (true) {
    const next = await Promise.race([reader.read(), deadline]);
    if (next === 'deadline' || next.done) return events;
    if (isWireEvent(next.value)) events.push(next.value);
  }
}

function checkoutAgent(storage: InMemoryStore, checkout: Gate, toolStarted: Gate) {
  let modelCalls = 0;
  return new Agent({
    id: 'checkout-agent',
    name: 'Checkout agent',
    instructions: 'Check out the pull request.',
    memory: new MockMemory({ storage }),
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({
        stream: new ReadableStream({
          start(stream) {
            stream.enqueue({ type: 'stream-start', warnings: [] });
            if (modelCalls++ === 0) {
              stream.enqueue({ type: 'text-start', id: 'intro' });
              stream.enqueue({ type: 'text-delta', id: 'intro', delta: 'Checking out the pull request.' });
              stream.enqueue({ type: 'text-end', id: 'intro' });
              stream.enqueue({ type: 'tool-call', toolCallId: 'checkout-1', toolName: 'checkout', input: '{}' });
              stream.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
            } else {
              stream.enqueue({ type: 'text-start', id: 'done' });
              stream.enqueue({ type: 'text-delta', id: 'done', delta: 'Checkout complete.' });
              stream.enqueue({ type: 'text-end', id: 'done' });
              stream.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
            }
            stream.close();
          },
        }),
      }),
    }),
    tools: {
      checkout: createTool({
        id: 'checkout',
        description: 'Check out the pull request',
        inputSchema: z.object({}),
        execute: async () => {
          toolStarted.open();
          await checkout.opened;
          return 'Checked out';
        },
      }),
    },
  });
}

describe('a browser stream opened while a real tool is executing', () => {
  it('opens with the prompt and the step in flight, then streams the completion', async () => {
    const checkout = gate();
    const toolStarted = gate();
    const storage = new InMemoryStore();
    const controller = new AgentController({
      id: 'code',
      storage,
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [{ id: 'build', agent: checkoutAgent(storage, checkout, toolStarted), default: true }],
      initialState: { yolo: true },
    });
    const mastra = new Mastra({ agentControllers: { code: controller }, storage, logger: false });
    await controller.init();
    const session = await controller.createSession({ id: 'mid-run', resourceId: 'mid-run', ownerId: 'code' });
    await mastra.startWorkers();
    await session.thread.create();
    const run = session.sendMessage({ content: 'Check out this pull request' });
    let reader: ReadableStreamDefaultReader<unknown> | undefined;
    try {
      await toolStarted.opened;
      await vi.waitFor(() => expect(session.displayState.get().activeTools.get('checkout-1')?.status).toBe('running'));

      reader = await openSessionStream(mastra);
      const opening = await readUntil(reader, event => event.type === 'message_update');
      expect(opening.filter(isMessageEvent)).toMatchObject([
        {
          type: 'message_end',
          message: { role: 'signal', content: { parts: [{ type: 'data-user-message' }] } },
        },
        {
          type: 'message_update',
          message: {
            role: 'assistant',
            content: {
              parts: expect.arrayContaining([
                {
                  type: 'tool-invocation',
                  toolInvocation: expect.objectContaining({ toolCallId: 'checkout-1', state: 'call' }),
                },
              ]),
            },
          },
        },
      ]);

      checkout.open();
      await run;
      const completion = await readUntil(reader, event => event.type === 'agent_end');
      expect(completion).toContainEqual(expect.objectContaining({ type: 'tool_end', toolCallId: 'checkout-1' }));
      expect(completion).toContainEqual(
        expect.objectContaining({ type: 'message_end', message: expect.objectContaining({ role: 'assistant' }) }),
      );
      await reader.cancel();

      reader = await openSessionStream(mastra);
      const afterRun = await readFor(reader, 50);
      expect(afterRun.filter(isMessageEvent)).toEqual([]);
    } finally {
      checkout.open();
      await run;
      await reader?.cancel();
      await mastra.shutdown();
    }
  }, 30_000);
});
