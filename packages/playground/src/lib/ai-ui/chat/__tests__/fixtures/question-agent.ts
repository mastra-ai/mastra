import { Agent } from '@mastra/core/agent';
import type { AgentExecutionOptions } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { OutputProcessor } from '@mastra/core/processors';
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

/** The same question tool run by the browser: no `execute`, so the run stops and hands it back. */
export const askQuestionInBrowser = createTool({
  id: 'askQuestion',
  description: 'Show the user a question with answer buttons',
  inputSchema: z.object({ question: z.string() }),
});

type StreamOptions = AgentExecutionOptions;
type RunOptions = Pick<StreamOptions, 'maxSteps' | 'stopWhen' | 'clientTools' | 'onIterationComplete'>;

/**
 * Ends the turn once the agent has asked its question, like an agent whose question tool waits for the user.
 * `stopWhen` accepts AI SDK v5 and v6 conditions, so the steps are typed by the one field both share here.
 */
export const stopAfterQuestion = ({ steps }: { steps: Array<{ toolCalls: Array<{ toolName: string }> }> }) =>
  (steps.at(-1)?.toolCalls ?? []).some(call => call.toolName === 'askQuestion');

/** Ends the turn from `onIterationComplete`, like a supervisor that stops the agent once it asks. */
export const endTurnFromHook: NonNullable<StreamOptions['onIterationComplete']> = () => ({ continue: false });

/**
 * A real agent whose model calls `askQuestion` on every step. The agent runs the
 * tool itself unless the run passes it as a client tool.
 */
const createQuestionAgent = (options: RunOptions) => {
  let modelCalls = 0;
  return new Agent({
    id: 'agent-1',
    name: 'Poster agent',
    instructions: 'Ask the user which style they want before designing.',
    tools: options.clientTools ? {} : { askQuestion },
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

/** Rejects the model's first draft and asks it to retry, like a guardrail processor. */
const rejectDraft: OutputProcessor = {
  id: 'reject-draft',
  processOutputStep: ({ text, abort, messageList }) => {
    if (text?.includes('Rejected draft')) abort('Ask the user instead', { retry: true });
    return messageList;
  },
};

/**
 * The chunks of a run whose first draft a processor rejected and retried before
 * the model called `askQuestion`, which `stopWhen` stops on. The retry re-runs
 * the step, so the run used one of its `maxSteps` though it reports two steps.
 */
export const streamRetriedQuestionAgent = async ({ maxSteps }: { maxSteps: number }): Promise<ChunkType[]> => {
  let modelCalls = 0;
  const agent = new Agent({
    id: 'agent-1',
    name: 'Poster agent',
    instructions: 'Ask the user which style they want before designing.',
    tools: { askQuestion },
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        const draft = modelCalls++ === 0;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              if (draft) {
                controller.enqueue({ type: 'text-start', id: 'draft' });
                controller.enqueue({ type: 'text-delta', id: 'draft', delta: 'Rejected draft' });
                controller.enqueue({ type: 'text-end', id: 'draft' });
              } else {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'askQuestion',
                  input: JSON.stringify({ question: 'Which style?' }),
                });
              }
              controller.enqueue({
                type: 'finish',
                finishReason: draft ? 'stop' : 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    }),
  });
  const output = await agent.stream('Make me a poster', {
    maxSteps,
    maxProcessorRetries: 1,
    stopWhen: stopAfterQuestion,
    outputProcessors: [rejectDraft],
  });
  const chunks: ChunkType[] = [];
  for await (const chunk of output.fullStream) chunks.push(chunk);
  return chunks;
};

/** The chunks the agent's own stream produced, as the agent stream route sends them. */
export const streamQuestionAgent = async (options: RunOptions): Promise<ChunkType[]> => {
  const output = await createQuestionAgent(options).stream('Make me a poster', options);
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
  const agent = createQuestionAgent(options);
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
