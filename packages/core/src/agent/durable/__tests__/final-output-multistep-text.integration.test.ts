import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../../../memory/src';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

describe.each(['ordinary', 'durable', 'evented'] as const)('processed multi-step text (%s)', execution => {
  // Durable engines currently ignore incremental saving; retained negative proof is separate.
  describe.each(execution === 'ordinary' ? [false, true] : [false])('savePerStep=%s', savePerStep => {
    it.each(['none', 'noop', 'remove-first', 'remove-last', 'remove-all', 'rewrite-first'] as const)(
      'preserves only the approved final response: %s',
      async change => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
        let modelCalls = 0;
        let toolCalls = 0;
        let checks = 0;
        const first = 'Private first step.';
        const last = 'Final answer.';
        const approved = 'Approved first step.';
        const content = (step: number) =>
          step === 1
            ? [
                { type: 'text' as const, text: first },
                { type: 'tool-call' as const, toolCallId: 'local', toolName: 'lookup', input: '{}' },
              ]
            : [{ type: 'text' as const, text: last }];
        const storage = new InMemoryStore();
        const memoryStore = await storage.getStore('memory');
        if (!memoryStore) throw new Error('Missing memory store');
        const saveMessages = vi.spyOn(memoryStore, 'saveMessages');
        let writesBeforeFinalCheck = 0;
        const base = new Agent({
          id: 'multi-final',
          name: 'Multi final',
          instructions: 'Look up then answer.',
          memory: new Memory({ storage, options: { generateTitle: false, observationalMemory: false } }),
          tools: {
            lookup: createTool({
              id: 'lookup',
              description: 'Local lookup',
              inputSchema: z.object({}),
              execute: async () => {
                toolCalls++;
                return { ok: true };
              },
            }),
          },
          model: new MastraLanguageModelV2Mock({
            doGenerate: async () => {
              const step = ++modelCalls;
              return {
                content: content(step),
                finishReason: step === 1 ? 'tool-calls' : 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              };
            },
            doStream: async () => {
              const step = ++modelCalls;
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    controller.enqueue({ type: 'text-start', id: `text-${step}` });
                    controller.enqueue({ type: 'text-delta', id: `text-${step}`, delta: step === 1 ? first : last });
                    controller.enqueue({ type: 'text-end', id: `text-${step}` });
                    if (step === 1)
                      controller.enqueue({ type: 'tool-call', toolCallId: 'local', toolName: 'lookup', input: '{}' });
                    controller.enqueue({
                      type: 'finish',
                      finishReason: step === 1 ? 'tool-calls' : 'stop',
                      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                    });
                    controller.close();
                  },
                }),
              };
            },
          }),
          outputProcessors:
            change === 'none'
              ? undefined
              : [
                  {
                    id: 'final-check',
                    processOutputResult({ messages }) {
                      checks++;
                      writesBeforeFinalCheck = saveMessages.mock.calls.length;
                      if (change === 'remove-all') return [];
                      return messages.flatMap(message => {
                        const text = message.content.parts
                          .filter(part => part.type === 'text')
                          .map(part => part.text)
                          .join('');
                        // Ordinary execution can merge both steps into one response message.
                        // Remove only the selected text, retaining the other approved step.
                        if (change === 'remove-first' || change === 'remove-last')
                          return [
                            {
                              ...message,
                              content: {
                                ...message.content,
                                parts: message.content.parts.map(part =>
                                  part.type === 'text'
                                    ? { ...part, text: part.text.replace(change === 'remove-first' ? first : last, '') }
                                    : part,
                                ),
                              },
                            },
                          ];
                        if (change === 'rewrite-first' && text.includes(first))
                          return [
                            {
                              ...message,
                              content: {
                                ...message.content,
                                parts: message.content.parts.map(part =>
                                  part.type === 'text' ? { ...part, text: part.text.replace(first, approved) } : part,
                                ),
                              },
                            },
                          ];
                        return [message];
                      });
                    },
                  },
                ],
        });
        const agent =
          execution === 'ordinary'
            ? base
            : execution === 'durable'
              ? createDurableAgent({ agent: base })
              : createEventedAgent({ agent: base });
        const mastra = new Mastra({
          agents: { agent },
          storage,
          logger: false,
          workers: false,
          scheduler: { enabled: false },
          recovery: { durableAgents: 'off' },
        });
        try {
          const result = await agent.generate('Complete the lookup task.', {
            maxSteps: 3,
            savePerStep,
            memory: { thread: 'multi-thread', resource: 'multi-resource' },
          });
          expect(modelCalls).toBe(2);
          expect(toolCalls).toBe(1);
          expect(checks).toBe(change === 'none' ? 0 : 1);
          if (savePerStep && change !== 'none') expect(writesBeforeFinalCheck).toBeGreaterThan(0);
          const expected =
            change === 'remove-all'
              ? ''
              : change === 'remove-first'
                ? last
                : change === 'remove-last'
                  ? first
                  : change === 'rewrite-first'
                    ? approved + last
                    : first + last;
          expect(result.text).toBe(expected);
          expect(result.finishReason).toBe('stop');
          expect(result.steps.map(step => step.text).join('')).toBe(first + last);
          expect(network).not.toHaveBeenCalled();
        } finally {
          await mastra.shutdown();
          network.mockRestore();
        }
      },
      15_000,
    );
  });
});
