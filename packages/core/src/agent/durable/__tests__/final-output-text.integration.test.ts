import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

describe.each(['ordinary', 'durable', 'evented'] as const)('final output text (%s)', execution => {
  it.each([
    { outcome: 'empty', method: 'generate' },
    { outcome: 'redacted', method: 'generate' },
    { outcome: 'empty', method: 'stream' },
    { outcome: 'redacted', method: 'stream' },
  ] as const)(
    'returns the processor-approved text: $method $outcome',
    async ({ outcome, method }) => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
      let checks = 0;
      let modelCalls = 0;
      const base = new Agent({
        id: 'final-text',
        name: 'Final text',
        instructions: 'Answer once.',
        model: new MastraLanguageModelV2Mock({
          doGenerate: async () => {
            modelCalls++;
            return {
              content: [{ type: 'text', text: 'Original private text.' }],
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          },
          doStream: async () => {
            modelCalls++;
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'text-start', id: 'answer' });
                  controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'Original private text.' });
                  controller.enqueue({ type: 'text-end', id: 'answer' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  controller.close();
                },
              }),
            };
          },
        }),
        outputProcessors: [
          {
            id: 'final-redaction',
            processOutputResult({ messages }) {
              checks++;
              return outcome === 'empty'
                ? []
                : messages.map(message => ({
                    ...message,
                    content: {
                      ...message.content,
                      content: 'Approved redacted text.',
                      parts: [{ type: 'text' as const, text: 'Approved redacted text.' }],
                    },
                  }));
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
        storage: new InMemoryStore(),
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      try {
        const expected = outcome === 'empty' ? '' : 'Approved redacted text.';
        let callbackText: string | undefined;
        const options = {
          onFinish: (data: { text: string }) => {
            callbackText = data.text;
          },
        };
        let result;
        if (method === 'generate') result = await agent.generate('Give the answer.', options);
        else {
          const stream = await agent.stream('Give the answer.', options);
          const output = 'output' in stream ? stream.output : stream;
          result = await output.getFullOutput();
          expect(await output.text).toBe(expected);
          expect(output.serializeState().processedText).toBe(expected);
        }
        expect(checks).toBe(1);
        expect(modelCalls).toBe(1);
        expect(result.text).toBe(expected);
        expect(callbackText).toBe(expected);
        expect(result.finishReason).toBe('stop');
        expect(network).not.toHaveBeenCalled();
      } finally {
        await mastra.shutdown();
        network.mockRestore();
      }
    },
    15_000,
  );
});
