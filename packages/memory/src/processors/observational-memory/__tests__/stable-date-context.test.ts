import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../index';

const observations =
  'Date: Nov 18, 2026\n- Event on November 20, 2026\n\n--- message boundary (2026-11-18T23:00:00.000Z) ---\n\nDate: Nov 21, 2026\n- User will visit (estimated November 18, 2026)';
const instants = ['2026-11-19T00:00:00Z', '2026-11-19T07:59:59Z', '2026-11-19T08:00:00Z', '2026-11-22T08:00:00Z'];

afterEach(() => vi.useRealTimers());

describe('stable observation date prefix', () => {
  it.each(
    [false, true].flatMap(readOnly => [undefined, true, false].map(liveDateHints => ({ readOnly, liveDateHints }))),
  )(
    'keeps the Agent observation prefix stable across record-local midnight (readOnly=$readOnly, liveDateHints=$liveDateHints)',
    async ({ readOnly, liveDateHints }) => {
      const store = new InMemoryStore();
      const memory = new Memory({
        storage: store,
        options: {
          lastMessages: 0,
          observationalMemory: {
            liveDateHints,
            scope: 'thread',
            observation: { model: 'openai/gpt-4o-mini', messageTokens: 100_000, bufferTokens: false },
            reflection: { observationTokens: 100_000 },
          },
        },
      });
      const threadId = 'stable-date-thread';
      const resourceId = 'stable-date-resource';
      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Stable dates',
          createdAt: new Date(instants[0]!),
          updatedAt: new Date(instants[0]!),
        },
      });
      const storage = await store.getStore('memory');
      if (!storage) throw new Error('Missing memory store');
      const record = await storage.initializeObservationalMemory({
        threadId,
        resourceId,
        scope: 'thread',
        config: {},
        observedTimezone: 'America/Los_Angeles',
      });
      await storage.updateActiveObservations({
        id: record.id,
        observations,
        tokenCount: 100,
        lastObservedAt: new Date('2026-11-18T23:00:00Z'),
      });
      const before = await storage.getObservationalMemory({ threadId, resourceId });
      const engine = await memory.omEngine;
      if (!engine) throw new Error('Missing OM engine');
      const observe = vi.spyOn(engine, 'observe');
      const prompts: { role: string; content: unknown }[][] = [];
      const model = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          prompts.push(prompt);
          return {
            content: [{ type: 'text', text: 'Noted.' }],
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 2, totalTokens: 102 },
            warnings: [],
          };
        },
      });
      const agent = new Agent({
        id: 'stable-date-actor',
        name: 'Stable date actor',
        instructions: 'Help the user.',
        model,
        memory,
      });
      vi.useFakeTimers({ toFake: ['Date'] });
      for (const instant of instants) {
        vi.setSystemTime(new Date(instant));
        await agent.generate('When is the event?', {
          memory: { thread: threadId, resource: resourceId, options: { readOnly } },
        });
      }
      expect(prompts).toHaveLength(instants.length);
      const systems = prompts.map(prompt => prompt.filter(message => message.role === 'system'));
      const prefix = systems.map(messages => {
        const closing = messages.findIndex(message => message.content === '</observations>');
        expect(closing).toBeGreaterThan(-1);
        return JSON.stringify(messages.slice(0, closing + 1));
      });
      expect(prefix[0]).toBe(prefix[1]);
      expect(prefix[1]).toBe(prefix[2]);
      for (const messages of systems) {
        const closing = messages.findIndex(message => message.content === '</observations>');
        const opening = messages.findIndex(message => message.content === '<observations>');
        expect(messages.slice(opening + 1, closing)).toHaveLength(2);
        const observationText = JSON.stringify(messages.slice(opening + 1, closing));
        expect(observationText).toContain('[3 days later]');
        expect(observationText).toContain('Date: Nov 18, 2026');
        expect(observationText).toContain('November 20, 2026');
        expect(observationText).not.toContain('(today)');
        expect(observationText).not.toContain('(yesterday)');
        expect(JSON.stringify(messages.slice(0, closing + 1))).not.toContain('message boundary');
        const hints = messages.filter(
          message => typeof message.content === 'string' && message.content.startsWith('<observation-date-hints>'),
        );
        expect(hints).toHaveLength(liveDateHints === false ? 0 : 1);
        if (hints.length) expect(messages.indexOf(hints[0]!)).toBeGreaterThan(closing);
      }
      const hints = systems.map(
        messages =>
          messages.find(
            message => typeof message.content === 'string' && message.content.startsWith('<observation-date-hints>'),
          )?.content,
      );
      expect(hints[0]).toBe(hints[1]);
      if (liveDateHints === false) {
        for (const messages of systems.slice(1)) expect(JSON.stringify(messages)).toBe(JSON.stringify(systems[0]));
      } else {
        expect(hints[0]).toContain('Date: Nov 18, 2026 (today)');
        expect(hints[0]).toContain('November 20, 2026 (in 2 days)');
        expect(hints[2]).toContain('Date: Nov 18, 2026 (yesterday)');
        expect(hints[2]).toContain('November 20, 2026 (tomorrow)');
        expect(hints[2]).toContain('likely already happened');
      }
      expect(observe).not.toHaveBeenCalled();
      expect(await storage.getObservationalMemory({ threadId, resourceId })).toEqual(before);
    },
  );
});
