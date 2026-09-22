/**
 * Regression test for #23815 / #22450: durable finish side effects in serve/HTTP topology.
 *
 * The terminal `map-final-output` mapping already executes inside the engine's durable
 * boundary (`wrapDurableOperation` -> `inngestStep.run`). Wrapping the finish side
 * effects in a second `params.engine.step.run(...)` created a nested Inngest step,
 * which the Inngest protocol does not support: the nested callback never executes and
 * its promise never settles. In serve/HTTP topology (step discovery/checkpointing per
 * request) this hung the run forever — no finish event, no output processors, no
 * memory persistence, no thread title (#22450), or silently skipped them (#23815).
 *
 * The existing connect-mode test (`durable-finish-side-effects.test.ts`) cannot cover
 * this: nested steps happen not to deadlock in connect topology. This test drives a
 * full durable turn through the served HTTP handler and asserts:
 *  1. The finish event arrives on the stream (no hang).
 *  2. The output processor's processOutputResult ran (persisted text is uppercased).
 *  3. The processed assistant message is persisted and a thread title is generated.
 */
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createInngestAgent } from '../durable-agent';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 150_000, hookTimeout: 90_000 });

const STREAM_TIMEOUT_MS = 60_000;
const READBACK_TIMEOUT_MS = 15_000;
const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-finish-serve-${Date.now()}.db`)).href;

function mockModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'finish-serve-model',
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: 'text', text: 'Durable Thread Title' }],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream() {
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'finish-serve-response',
              modelId: 'finish-serve-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'hello from durable agent' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

const uppercaseOutputProcessor = {
  id: 'uppercase-finish-serve',
  processOutputResult: async ({ messages }: { messages: MastraDBMessage[] }) => {
    return messages.map(message => ({
      ...message,
      content: {
        ...message.content,
        parts: message.content.parts.map(part =>
          part.type === 'text' ? { ...part, text: part.text.toUpperCase() } : part,
        ),
      },
    }));
  },
};

describe('durable finish side effects in serve topology (#23815 / #22450)', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it('emits finish, runs output processors, persists processed text, generates title', async () => {
    const agentId = `finish-serve-agent-${Date.now()}`;
    const threadId = `finish-serve-thread-${Date.now()}`;
    const resourceId = `finish-serve-resource-${Date.now()}`;

    const storage = new DefaultStorage({ id: `finish-serve-${agentId}`, url: dbUrl });
    const agent = new Agent({
      id: agentId,
      name: 'Finish Side Effects Serve Agent',
      instructions: 'Reply briefly.',
      model: mockModel(),
      memory: new Memory({ storage, options: { generateTitle: true } }),
      outputProcessors: [uppercaseOutputProcessor],
    });

    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const result = await inngestAgent.stream([{ role: 'user', content: 'Say hello.' }], {
      memory: { thread: threadId, resource: resourceId },
    });

    const chunkTypes: string[] = [];
    let finishReceived = false;
    let timedOut = false;

    try {
      await Promise.race([
        (async () => {
          for await (const chunk of result.output.fullStream) {
            chunkTypes.push((chunk as any)?.type ?? 'unknown');
            if ((chunk as any)?.type === 'finish') finishReceived = true;
          }
        })(),
        new Promise<void>(resolve =>
          setTimeout(() => {
            timedOut = true;
            resolve();
          }, STREAM_TIMEOUT_MS),
        ),
      ]);
    } finally {
      result.cleanup();
    }

    // Finish-side-effect persistence completes shortly after the finish event;
    // poll the readback instead of sleeping a fixed amount.
    const store = await storage.getStore('memory');
    let assistantText = '';
    let title: string | undefined;
    const readbackDeadline = Date.now() + READBACK_TIMEOUT_MS;
    while (Date.now() < readbackDeadline) {
      const messages = ((await store!.listMessages({ threadId } as never)) as any)?.messages ?? [];
      const assistant = messages.find((m: any) => m.role === 'assistant');
      assistantText = (assistant?.content?.parts ?? [])
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
      title = (await store!.getThreadById({ threadId }))?.title;
      if (assistantText && title && title !== 'New Thread') break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    expect(timedOut, `stream timed out after ${STREAM_TIMEOUT_MS}ms; chunks so far: ${chunkTypes.join(',')}`).toBe(
      false,
    );
    expect(finishReceived).toBe(true);
    expect(assistantText).toBe('HELLO FROM DURABLE AGENT');
    expect(title).toBe('Durable Thread Title');
  });
});
