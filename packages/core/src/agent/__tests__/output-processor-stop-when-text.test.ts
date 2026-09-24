import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Processor, ProcessOutputResultArgs, ProcessOutputStreamArgs } from '../../processors';
import type { ChunkType } from '../../stream';
import { createTool } from '../../tools/tool';
import { Agent } from '../agent';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/24917
 *
 * When the last step has text and a tool call, and stopWhen ends the run after
 * that tool, the response list ends in a tool-result message. A pass-through
 * output processor used to read that message and blank `stream.text`.
 */
describe('output processor text when stopWhen ends on a tool call (issue #24917)', () => {
  const ask = createTool({
    id: 'ask',
    description: 'ask the user',
    inputSchema: z.object({ q: z.string() }),
    execute: async () => ({ ok: true }),
  });

  function makeModel() {
    return new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello there.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'ask',
            input: JSON.stringify({ q: 'Next?' }),
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });
  }

  async function run(outputProcessors?: Processor[]) {
    const agent = new Agent({
      id: 'ask-agent',
      name: 'Ask Agent',
      instructions: 'Ask the user before continuing.',
      model: makeModel(),
      tools: { ask },
      ...(outputProcessors ? { outputProcessors } : {}),
    });

    const stream = await agent.stream('hi', {
      stopWhen: ({ steps }: { steps: Array<{ toolCalls?: Array<{ toolName?: string }> }> }) =>
        steps.some(step => step.toolCalls?.some(call => call.toolName === 'ask')),
    });

    let deltas = '';
    for await (const chunk of stream.fullStream as AsyncIterable<ChunkType>) {
      if (chunk.type === 'text-delta') deltas += chunk.payload.text;
    }

    return {
      deltas,
      text: await stream.text,
      lastStepText: (await stream.steps).at(-1)?.text,
    };
  }

  it('keeps the step text when a pass-through processOutputStream is configured', async () => {
    class PassthroughProcessor implements Processor {
      readonly id = 'passthrough';
      readonly name = 'Passthrough';

      async processOutputStream({ part }: ProcessOutputStreamArgs) {
        return part;
      }
    }

    const withoutProcessor = await run();
    const withProcessor = await run([new PassthroughProcessor()]);

    expect(withoutProcessor).toEqual({
      deltas: 'Hello there.',
      text: 'Hello there.',
      lastStepText: 'Hello there.',
    });
    expect(withProcessor).toEqual(withoutProcessor);
  });

  it('still applies a processor that rewrites or clears the assistant text', async () => {
    class UppercaseProcessor implements Processor {
      readonly id = 'uppercase';
      readonly name = 'Uppercase';

      async processOutputResult({ messages }: ProcessOutputResultArgs) {
        return messages.map(message => ({
          ...message,
          content: {
            ...message.content,
            parts: message.content.parts.map(part =>
              part.type === 'text' ? { ...part, text: part.text.toUpperCase() } : part,
            ),
          },
        }));
      }
    }

    class RedactProcessor implements Processor {
      readonly id = 'redact';
      readonly name = 'Redact';

      async processOutputResult({ messages }: ProcessOutputResultArgs) {
        return messages.map(message => ({
          ...message,
          content: {
            ...message.content,
            parts: message.content.parts.map(part => (part.type === 'text' ? { ...part, text: '' } : part)),
          },
        }));
      }
    }

    await expect(run([new UppercaseProcessor()])).resolves.toMatchObject({
      text: 'HELLO THERE.',
      lastStepText: 'HELLO THERE.',
    });
    await expect(run([new RedactProcessor()])).resolves.toMatchObject({
      text: '',
      lastStepText: '',
    });
  });
});
