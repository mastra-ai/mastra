/**
 * A stored attachment that can't be downloaded (a relative or protocol-relative path, or one persisted
 * as a malformed base64 data URL by older versions, see #23705) must not break the
 * thread. The OM observer replaces it with a placeholder and carries on, instead of
 * failing the turn after minutes of retries.
 */

import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

function streamOf(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function createActorModel() {
  let calls = 0;
  const prompts: unknown[] = [];
  const model = {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-actor',
    supportedUrls: {},
    prompts,
    async doGenerate(): Promise<never> {
      throw new Error('not used');
    },
    async doStream({ prompt }: { prompt: unknown }) {
      prompts.push(prompt);
      const first = calls++ === 0;
      return {
        stream: streamOf(
          first
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', input: '{}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Done.' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 100, outputTokens: 5, totalTokens: 105 },
                },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
  return model;
}

function createObserverModel() {
  const model = {
    specificationVersion: 'v2' as const,
    provider: 'mock-observer',
    modelId: 'mock-observer',
    supportedUrls: {},
    calls: 0,
    prompts: [] as unknown[],
    async doGenerate(): Promise<never> {
      throw new Error('not used');
    },
    async doStream({ prompt }: { prompt: unknown }) {
      model.calls++;
      model.prompts.push(prompt);
      return {
        stream: streamOf([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          {
            type: 'text-delta',
            id: 'text-1',
            delta: '<observations>\n<thread id="poisoned-thread">\n- ok\n</thread>\n</observations>',
          },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
  return model;
}

const relativePath = '/relative/path.png';
const malformedDataUrl = `data:image/png;base64,${relativePath}`;
const protocolRelativeUrl = '//cdn.example.com/foo.png';

describe('OM observer with an undownloadable stored attachment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['thread', 'malformed data URL', malformedDataUrl, relativePath],
    ['resource', 'malformed data URL', malformedDataUrl, relativePath],
    ['thread', 'relative path', relativePath, relativePath],
    ['resource', 'relative path', relativePath, relativePath],
    ['thread', 'protocol-relative URL', protocolRelativeUrl, protocolRelativeUrl],
    ['resource', 'protocol-relative URL', protocolRelativeUrl, protocolRelativeUrl],
  ] as const)(
    'is skipped by the OM observer instead of failing the turn (%s scope, %s)',
    async (scope, _label, storedData, path) => {
      const realFetch = globalThis.fetch;
      let assetFetches = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        if (String(input).includes(path)) assetFetches++;
        return realFetch(input, init);
      });

      const observerModel = createObserverModel();
      const storage = new InMemoryStore();
      const memory = new Memory({
        storage,
        options: {
          observationalMemory: {
            enabled: true,
            scope,
            observation: { model: observerModel as any, messageTokens: 20, bufferTokens: false },
            reflection: { observationTokens: 50_000 },
          },
        },
      });

      const threadId = 'poisoned-thread';
      const resourceId = 'poisoned-resource';
      await memory.createThread({ threadId, resourceId });
      const poisonedMessage: MastraDBMessage = {
        id: 'stored-user-image',
        role: 'user',
        threadId,
        resourceId,
        createdAt: new Date(Date.now() - 60_000),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Here is a screenshot of the dashboard I mentioned earlier today.' },
            { type: 'file', data: storedData, mimeType: 'image/png' },
          ],
        },
      };
      await memory.saveMessages({ messages: [poisonedMessage] });

      const actorModel = createActorModel();
      const agent = new Agent({
        id: 'download-failure-agent',
        name: 'Download Failure Agent',
        instructions: 'Use the test tool first.',
        model: actorModel as any,
        tools: {
          test: createTool({
            id: 'test',
            description: 'Trigger tool',
            inputSchema: z.object({}),
            execute: async () => ({ ok: true }),
          }),
        },
        memory,
      });

      const startedAt = Date.now();
      const stream = await agent.stream('Can you describe what the screenshot shows in detail, please?', {
        memory: { thread: threadId, resource: resourceId },
      });
      const result = await stream.getFullOutput();
      const elapsedMs = Date.now() - startedAt;

      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe('Done.');
      // Invalid inline content and paths without a scheme are recognized without fetching them.
      expect(assetFetches).toBe(0);
      expect(elapsedMs).toBeLessThan(10_000);

      expect(observerModel.calls).toBeGreaterThan(0);
      const firstObserverPrompt = JSON.stringify(observerModel.prompts[0]);
      expect(firstObserverPrompt).toContain('screenshot of the dashboard');
      expect(firstObserverPrompt).toContain('[Attachment unavailable: image/png]');

      for (const prompt of [...actorModel.prompts, ...observerModel.prompts]) {
        expect(JSON.stringify(prompt)).not.toContain(path);
      }

      const memoryStore = await storage.getStore('memory');
      const record = await memoryStore!.getObservationalMemory(scope === 'resource' ? null : threadId, resourceId);
      expect(record?.activeObservations).toContain('- ok');
    },
    30_000,
  );
});
