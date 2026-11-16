import { Agent } from '@mastra/core/agent';
import type { ChunkType } from '@mastra/core/stream';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const askQuestion = createTool({
  id: 'askQuestion',
  description: 'Show the user a question with answer buttons',
  inputSchema: z.object({ question: z.string() }),
  execute: async () => ({ shown: true }),
});

type StreamOptions = NonNullable<Parameters<Agent['stream']>[1]>;

/** Ends the turn once the agent has asked its question, like an agent whose question tool waits for the user. */
export const stopAfterQuestion: NonNullable<StreamOptions['stopWhen']> = ({ steps }) =>
  (steps.at(-1)?.toolCalls ?? []).some(call => call.toolName === 'askQuestion');

/**
 * Runs a real agent whose model calls `askQuestion` on every step, and returns
 * the chunks its stream produced, as the agent stream route sends them.
 */
export const streamQuestionAgent = async (
  options: Pick<StreamOptions, 'maxSteps' | 'stopWhen'>,
): Promise<ChunkType[]> => {
  let modelCalls = 0;
  const agent = new Agent({
    id: 'agent-1',
    name: 'Poster agent',
    instructions: 'Ask the user which style they want before designing.',
    tools: { askQuestion },
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        modelCalls++;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: `call-${modelCalls}`,
                toolName: 'askQuestion',
                input: JSON.stringify({ question: 'Which style?' }),
              });
              controller.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    }),
  });

  const output = await agent.stream('Make me a poster', options);
  const chunks: ChunkType[] = [];
  for await (const chunk of output.fullStream) chunks.push(chunk);
  return chunks;
};
