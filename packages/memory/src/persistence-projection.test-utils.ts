import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent, createSignal } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from './index';

type LanguageModelV2StreamPart =
  Awaited<ReturnType<MockLanguageModelV2['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part : never;

const threadId = 'projection-thread';
const resourceId = 'projection-resource';

function message(id = 'assistant'): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      content: 'Visible <working_memory>private text</working_memory>',
      metadata: { mastra: { sealed: true }, custom: 'retained' },
      parts: [
        { type: 'text', text: 'Visible <working_memory>private text</working_memory>' },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolName: 'lookup',
            toolCallId: 'normal',
            args: {},
            result: 'public result',
          },
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'partial-call',
            toolName: 'lookup',
            toolCallId: 'partial',
            args: { query: 'unfinished' },
          },
        },
        { type: 'data-om-observation-end', data: { cycleId: 'cycle' } },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'partial-call',
            toolName: 'updateWorkingMemory',
            toolCallId: 'wm-partial',
            args: { memory: 'private partial args' },
          },
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolName: 'updateWorkingMemory',
            toolCallId: 'wm',
            args: { memory: 'private args' },
            result: { success: true },
          },
          ...{ metadata: { mastra: { sealedAt: 123 } } },
        },
      ],
    },
  };
}

function assertProjection(stored: MastraDBMessage) {
  expect(JSON.stringify(stored)).not.toMatch(/private|updateWorkingMemory|working_memory/);
  expect(stored.content).toMatchObject({
    content: 'Visible',
    metadata: { mastra: { sealed: true }, custom: 'retained' },
  });
  expect(stored.content.parts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'text', text: 'Visible' }),
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({ toolName: 'lookup', result: 'public result' }),
      }),
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({ state: 'partial-call', toolName: 'lookup', toolCallId: 'partial' }),
      }),
      expect.objectContaining({ type: 'data-om-observation-end', metadata: { mastra: { sealedAt: 123 } } }),
    ]),
  );
}

export function testPersistenceProjection(createStorage: () => Promise<MastraCompositeStore>) {
  describe('Working memory persistence projection (#27946)', () => {
    it.each(['save', 'persist'] as const)(
      'keeps the empty-message and state-signal audit policies on %s',
      async mode => {
        const memory = new Memory({ storage: await createStorage() });
        await memory.createThread({ threadId, resourceId });
        const hidden = message().content.parts[4]!;
        const audit: MastraDBMessage = {
          ...message('audit'),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolName: 'setWorkingMemory',
                  toolCallId: 'state',
                  args: { memory: 'audit data' },
                },
              },
            ],
          },
        };
        const messages: MastraDBMessage[] = [
          { ...message('empty'), content: { format: 2, parts: [hidden] } },
          { ...message('fallback'), content: { format: 2, parts: [hidden], content: 'Fallback text' } },
          audit,
        ];
        if (mode === 'save') await memory.saveMessages({ messages });
        else await memory.persistMessages(messages);
        const recalled = await memory.recall({ threadId, resourceId, perPage: false });
        expect(recalled.messages.map(m => m.id).sort()).toEqual(['audit', 'fallback']);
        expect(recalled.messages.find(m => m.id === 'fallback')?.content.content).toBe('Fallback text');
        expect(recalled.messages.find(m => m.id === 'audit')?.content.parts).toEqual(audit.content.parts);
      },
    );

    it('sanitizes raw sealed upserts without changing live messages or dropping lifecycle markers', async () => {
      const memory = new Memory({ storage: await createStorage() });
      await memory.createThread({ threadId, resourceId });
      const live = message();
      const snapshot = structuredClone(live);
      const signal = createSignal({ id: 'signal', type: 'reactive', contents: 'transient', transient: true });
      await memory.persistMessages([
        live,
        { ...message('system'), role: 'system' },
        signal.toDBMessage({ threadId, resourceId }),
      ]);
      const recalled = await memory.recall({ threadId, resourceId, perPage: false });
      expect(recalled.messages).toHaveLength(1);
      assertProjection(recalled.messages[0]!);
      expect(live).toEqual(snapshot);
    });

    it('sanitizes partial text edits while retaining omitted parts and metadata', async () => {
      const storage = await createStorage();
      const memory = new Memory({ storage });
      await memory.createThread({ threadId, resourceId });
      await memory.persistMessages([message()]);
      const update = {
        id: 'assistant',
        content: {
          format: 2 as const,
          content: 'Visible <working_memory>private replacement</working_memory>',
          metadata: { edited: true },
        },
      };
      const snapshot = structuredClone(update);
      // @ts-expect-error Storage supports nested partial content patches at runtime.
      await memory.updateMessages({ messages: [update] });
      const recalled = await memory.recall({ threadId, resourceId, perPage: false });
      assertProjection(recalled.messages[0]!);
      expect(recalled.messages[0]!.content.metadata).toMatchObject({ edited: true });
      expect(update).toEqual(snapshot);
    });

    it('does not overwrite concurrent text edits with omitted fields in partial patches', async () => {
      const memory = new Memory({ storage: await createStorage() });
      await memory.createThread({ threadId, resourceId });
      await memory.saveMessages({
        messages: [{ ...message(), content: { format: 2, parts: [{ type: 'text', text: 'Original' }] } }],
      });
      await Promise.all([
        memory.updateMessages({
          messages: [{ id: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'Edited' }] } }],
        }),
        memory.updateMessages({ messages: [{ id: 'assistant', role: 'user' }] }),
        // @ts-expect-error Storage supports nested partial content patches at runtime.
        memory.updateMessages({ messages: [{ id: 'assistant', content: { format: 2, metadata: { edited: true } } }] }),
      ]);
      const recalled = await memory.recall({ threadId, resourceId, perPage: false });
      expect(recalled.messages[0]).toMatchObject({
        role: 'user',
        content: {
          parts: [{ type: 'text', text: 'Edited' }],
          metadata: { edited: true },
        },
      });
    });

    describe('semantic recall index on edits', () => {
      async function setup() {
        const vector = {
          id: 'projection-vector',
          isSelfEmbedding: true,
          createIndex: vi.fn().mockResolvedValue(undefined),
          upsert: vi.fn().mockResolvedValue([]),
          query: vi.fn().mockResolvedValue([]),
          listIndexes: vi.fn().mockResolvedValue(['memory_messages']),
          deleteVectors: vi.fn().mockResolvedValue(undefined),
          describeIndex: vi.fn().mockResolvedValue({ dimension: 1024 }),
        };
        const memory = new Memory({
          storage: await createStorage(),
          vector: vector as unknown as MastraVector,
          options: { semanticRecall: { topK: 2, messageRange: 0, scope: 'resource' }, generateTitle: false },
        });
        await memory.createThread({ threadId, resourceId });
        await memory.persistMessages([
          {
            ...message(),
            content: {
              format: 2,
              content: 'Stale mirror',
              parts: [{ type: 'text', text: 'Stored visible text' }],
            },
          },
        ]);
        vector.upsert.mockClear();
        return { memory, vector };
      }

      it('indexes stored visible parts when an edit leaves only working memory in content', async () => {
        const { memory, vector } = await setup();
        await memory.updateMessages({
          // @ts-expect-error Storage supports nested partial content patches at runtime.
          messages: [{ id: 'assistant', content: { format: 2, content: '<working_memory>private</working_memory>' } }],
        });
        expect(vector.upsert).toHaveBeenCalledTimes(1);
        expect(vector.upsert.mock.calls[0]![0]).toMatchObject({ documents: ['Stored visible text'] });
        expect(JSON.stringify(vector.upsert.mock.calls)).not.toMatch(/private|working_memory/);
      });

      it('indexes edited parts ahead of an omitted stale content mirror', async () => {
        const { memory, vector } = await setup();
        await memory.updateMessages({
          messages: [{ id: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'Edited parts' }] } }],
        });
        expect(vector.upsert.mock.calls[0]![0]).toMatchObject({ documents: ['Edited parts'] });
      });

      it('removes vectors when an edit clears the patched text', async () => {
        const { memory, vector } = await setup();
        await memory.updateMessages({ messages: [{ id: 'assistant', content: { format: 2, parts: [] } }] });
        expect(vector.upsert).not.toHaveBeenCalled();
        expect(vector.deleteVectors).toHaveBeenCalledWith(
          expect.objectContaining({ filter: { message_id: { $in: ['assistant'] } } }),
        );
      });

      it('indexes each edited message once when an update repeats its id', async () => {
        const { memory, vector } = await setup();
        await memory.updateMessages({
          messages: [
            { id: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'First edit' }] } },
            // @ts-expect-error Storage supports nested partial content patches at runtime.
            { id: 'assistant', content: { format: 2, metadata: { edited: true } } },
          ],
        });
        expect(vector.upsert).toHaveBeenCalledTimes(1);
        expect(vector.upsert.mock.calls[0]![0]).toMatchObject({ documents: ['First edit'] });
      });

      it('keeps vectors when an edit does not touch text', async () => {
        const { memory, vector } = await setup();
        await memory.updateMessages({
          // @ts-expect-error Storage supports nested partial content patches at runtime.
          messages: [{ id: 'assistant', content: { format: 2, metadata: { edited: true } } }],
        });
        expect(vector.deleteVectors).not.toHaveBeenCalled();
        expect(vector.upsert).not.toHaveBeenCalled();
      });
    });

    it.each(['save', 'persist', 'update'] as const)(
      'keeps ordinary partial calls and hides working-memory calls in parts and legacy mirrors on %s',
      async mode => {
        const memory = new Memory({ storage: await createStorage() });
        await memory.createThread({ threadId, resourceId });
        const ordinary = {
          state: 'partial-call' as const,
          toolName: 'lookup',
          toolCallId: 'partial',
          args: { query: 'unfinished' },
        };
        const workingMemory = {
          state: 'partial-call' as const,
          toolName: 'updateWorkingMemory',
          toolCallId: 'wm-partial',
          args: { memory: 'private partial args' },
        };
        const live: MastraDBMessage = {
          ...message(),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Visible' },
              { type: 'tool-invocation', toolInvocation: ordinary },
              { type: 'tool-invocation', toolInvocation: workingMemory },
            ],
            toolInvocations: [ordinary, workingMemory],
          },
        };
        const snapshot = structuredClone(live);
        if (mode === 'save') {
          await memory.saveMessages({ messages: [live] });
        } else if (mode === 'persist') {
          await memory.persistMessages([live]);
        } else {
          await memory.saveMessages({
            messages: [{ ...message(), content: { format: 2, parts: [{ type: 'text', text: 'Original' }] } }],
          });
          await memory.updateMessages({ messages: [{ id: live.id, content: live.content }] });
        }
        const recalled = await memory.recall({ threadId, resourceId, perPage: false });
        expect(JSON.stringify(recalled.messages)).not.toMatch(/private|updateWorkingMemory/);
        expect(recalled.messages[0]?.content.parts).toEqual([
          { type: 'text', text: 'Visible' },
          { type: 'tool-invocation', toolInvocation: ordinary },
        ]);
        expect(recalled.messages[0]?.content.toolInvocations).toEqual([ordinary]);
        expect(live).toEqual(snapshot);
      },
    );

    it('hides replaced parts and skips system, transient and empty edits without deleting rows', async () => {
      const memory = new Memory({ storage: await createStorage() });
      await memory.createThread({ threadId, resourceId });
      await memory.saveMessages({
        messages: ['replace', 'system', 'transient', 'empty'].map(id => ({
          ...message(id),
          content: { format: 2, parts: [{ type: 'text', text: 'Original' }], metadata: { original: true } },
        })),
      });
      const signal = createSignal({ id: 'signal', type: 'reactive', contents: 'transient', transient: true });
      await memory.updateMessages({
        messages: [
          { ...message('replace') },
          { id: 'system', role: 'system' },
          { id: 'transient', role: 'signal', content: signal.toDBMessage({ threadId, resourceId }).content },
          { id: 'empty', content: { format: 2, parts: [message().content.parts[4]!] } },
        ],
      });
      const recalled = await memory.recall({ threadId, resourceId, perPage: false });
      assertProjection(recalled.messages.find(m => m.id === 'replace')!);
      for (const id of ['system', 'transient', 'empty']) {
        expect(recalled.messages.find(m => m.id === id)?.content.parts).toEqual([{ type: 'text', text: 'Original' }]);
      }
    });

    it.each(['generate', 'stream'] as const)(
      'hides working memory after an Agent %s crosses the OM buffer seal',
      async mode => {
        const threadId = `projection-${mode}`;
        let boundaryMessages: MastraDBMessage[] = [];
        const observation = '<observations>\n* User asked to remember a preference.\n</observations>';
        const observer = new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'obs' },
              { type: 'text-delta', id: 'obs', delta: observation },
              { type: 'text-end', id: 'obs' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            ]),
          }),
        });
        const memory = new Memory({
          storage: await createStorage(),
          options: {
            semanticRecall: false,
            workingMemory: { enabled: true, scope: 'thread', template: '# Preferences' },
            observationalMemory: {
              scope: 'thread',
              model: observer,
              observation: { messageTokens: 10000, bufferTokens: 100 },
              reflection: { observationTokens: 100000 },
            },
          },
        });
        let step = 0;
        const actor = new MockLanguageModelV2({
          doGenerate: async () => {
            const first = step++ === 0;
            if (!first) boundaryMessages = (await memory.recall({ threadId, resourceId, perPage: false })).messages;
            return {
              content: first
                ? [
                    {
                      type: 'text',
                      text: 'Remembered '.repeat(200) + '<working_memory>private narration</working_memory>',
                    },
                    { type: 'tool-call', toolCallId: 'normal', toolName: 'lookup', input: '{}' },
                    {
                      type: 'tool-call',
                      toolCallId: 'wm',
                      toolName: 'updateWorkingMemory',
                      input: JSON.stringify({ memory: '# Preferences\nprivate preference' }),
                    },
                  ]
                : [{ type: 'text', text: 'Done.' }],
              finishReason: first ? 'tool-calls' : 'stop',
              usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
              warnings: [],
            };
          },
          doStream: async () => {
            const first = step++ === 0;
            if (!first) boundaryMessages = (await memory.recall({ threadId, resourceId, perPage: false })).messages;
            return {
              stream: convertArrayToReadableStream<LanguageModelV2StreamPart>(
                first
                  ? [
                      { type: 'stream-start', warnings: [] },
                      { type: 'text-start', id: 'actor' },
                      {
                        type: 'text-delta',
                        id: 'actor',
                        delta: 'Remembered '.repeat(200) + '<working_memory>private narration</working_memory>',
                      },
                      { type: 'text-end', id: 'actor' },
                      { type: 'tool-call', toolCallId: 'normal', toolName: 'lookup', input: '{}' },
                      {
                        type: 'tool-call',
                        toolCallId: 'wm',
                        toolName: 'updateWorkingMemory',
                        input: JSON.stringify({ memory: '# Preferences\nprivate preference' }),
                      },
                      {
                        type: 'finish',
                        finishReason: 'tool-calls',
                        usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
                      },
                    ]
                  : [
                      { type: 'stream-start', warnings: [] },
                      { type: 'text-start', id: 'done' },
                      { type: 'text-delta', id: 'done', delta: 'Done.' },
                      { type: 'text-end', id: 'done' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
                      },
                    ],
              ),
            };
          },
        });
        const agent = new Agent({
          id: `projection-${mode}`,
          name: 'Preferences',
          instructions: 'Remember preferences.',
          model: actor,
          memory,
          tools: {
            lookup: createTool({
              id: 'lookup',
              description: 'Look up public information',
              inputSchema: z.object({}),
              execute: async () => 'public result',
            }),
          },
        });
        const options = { memory: { thread: threadId, resource: resourceId }, maxSteps: 3 };
        if (mode === 'stream') {
          const result = await agent.stream('Remember my preference.', options);
          await result.consumeStream();
        } else {
          await agent.generate('Remember my preference.', options);
        }
        await memory.settled();
        expect(await memory.getWorkingMemory({ threadId, resourceId })).toContain('private preference');
        const recalled = await memory.recall({ threadId, resourceId, perPage: false });
        expect(boundaryMessages.length).toBeGreaterThan(0);
        expect(JSON.stringify(boundaryMessages)).not.toMatch(/private|updateWorkingMemory|working_memory/);
        const sealed = recalled.messages.filter(
          m => m.role === 'assistant' && (m.content.metadata?.mastra as { sealed?: boolean } | undefined)?.sealed,
        );
        expect(sealed.length).toBeGreaterThan(0);
        expect(JSON.stringify(recalled.messages)).not.toMatch(/private|updateWorkingMemory|working_memory/);
        expect(JSON.stringify(recalled.messages)).toContain('Remember my preference.');
        expect(JSON.stringify(recalled.messages)).toContain('public result');
        expect(JSON.stringify(recalled.messages)).toContain('data-om-buffering-start');
        expect(JSON.stringify(recalled.messages)).toContain('data-om-buffering-end');
        expect(sealed.some(m => m.content.parts.some(p => 'metadata' in p && !!p.metadata))).toBe(true);
      },
    );
  });
}
