import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
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
type RunOptions = Pick<StreamOptions, 'maxSteps' | 'stopWhen'>;

/** Ends the turn once the agent has asked its question, like an agent whose question tool waits for the user. */
export const stopAfterQuestion: NonNullable<StreamOptions['stopWhen']> = ({ steps }) =>
  (steps.at(-1)?.toolCalls ?? []).some(call => call.toolName === 'askQuestion');

/** A real agent whose model calls `askQuestion` on every step. */
const createQuestionAgent = () => {
  let modelCalls = 0;
  return new Agent({
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
};

/** The chunks the agent's own stream produced, as the agent stream route sends them. */
export const streamQuestionAgent = async (options: RunOptions): Promise<ChunkType[]> => {
  const output = await createQuestionAgent().stream('Make me a poster', options);
  const chunks: ChunkType[] = [];
  for await (const chunk of output.fullStream) chunks.push(chunk);
  return chunks;
};

/**
 * The chunks a thread subscriber received while the agent ran on `thread-1`, as
 * the thread subscribe route sends them to Studio's default signal transport.
 * Thread broadcasts are slimmed copies of the run's chunks, not the chunks themselves.
 */
export const broadcastQuestionAgent = async (options: RunOptions): Promise<ChunkType[]> => {
  const agent = createQuestionAgent();
  new Mastra({ agents: { agent }, logger: false });
  const memory = { thread: 'thread-1', resource: 'user-1' };
  const subscription = await agent.subscribeToThread({ threadId: memory.thread, resourceId: memory.resource });
  try {
    const output = await agent.stream('Make me a poster', { ...options, memory });
    await output.consumeStream();
    const chunks: ChunkType[] = [];
    for await (const chunk of subscription.stream) {
      chunks.push(chunk);
      if (chunk.type === 'finish') break;
    }
    return chunks;
  } finally {
    subscription.unsubscribe();
  }
};
