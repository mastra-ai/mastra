import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const responseText = 'hello from experiment worker';
const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function textModel(text: string) {
  return {
    specificationVersion: 'v2' as const,
    provider: 'experiment-e2e',
    modelId: 'deterministic-model',
    supportedUrls: {},
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage,
      content: [{ type: 'text' as const, text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          for (const event of [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'response-1', modelId: 'deterministic-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: text },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage },
          ]) {
            controller.enqueue(event);
          }
          controller.close();
        },
      }),
    }),
  };
}

const minimalAgent = new Agent({
  id: 'minimal-agent',
  name: 'Minimal Agent',
  instructions: 'Return the deterministic model response.',
  model: textModel(responseText),
});

const lookupTool = createTool({
  id: 'lookup-tool',
  description: 'Looks up a deterministic value.',
  inputSchema: z.object({ key: z.string() }),
  outputSchema: z.object({ value: z.string() }),
  execute: async ({ key }) => {
    await writeFile(join(process.cwd(), 'live-tool-ran.txt'), key);
    return { value: 'live-value' };
  },
});

let toolModelCall = 0;
const toolModel = {
  ...textModel('tool completed'),
  doGenerate: async () => {
    toolModelCall += 1;
    if (toolModelCall % 2 === 1) {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls' as const,
        usage,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `lookup-${toolModelCall}`,
            toolName: 'lookup-tool',
            input: JSON.stringify({ key: 'fixture-key' }),
          },
        ],
        warnings: [],
      };
    }
    return textModel('tool completed').doGenerate();
  },
};

const mockedToolAgent = new Agent({
  id: 'mocked-tool-agent',
  name: 'Mocked Tool Agent',
  instructions: 'Call lookup-tool before answering.',
  model: toolModel,
  tools: { lookupTool },
});

const slowModel = {
  ...textModel('slow response'),
  doGenerate: async ({ abortSignal }: { abortSignal?: AbortSignal } = {}) => {
    await new Promise<void>((resolve, reject) => {
      const abortError = () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return error;
      };
      if (abortSignal?.aborted) {
        reject(abortError());
        return;
      }
      const timer = setTimeout(resolve, 25_000);
      abortSignal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true },
      );
    });
    return textModel('slow response').doGenerate();
  },
};

const slowAgent = new Agent({
  id: 'slow-agent',
  name: 'Slow Agent',
  instructions: 'Wait before responding so cancellation can interrupt the run.',
  model: slowModel,
});

const approvalStep = createStep({
  id: 'approval-step',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ reason: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ suspend, resumeData }) => {
    if (resumeData === undefined) {
      await suspend({ reason: 'Approval required' });
      return { approved: false };
    }
    return { approved: resumeData.approved };
  },
});

const resumableWorkflow = createWorkflow({
  id: 'resumable-workflow',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
})
  .then(approvalStep)
  .commit();

const syncScorer = createScorer({
  id: 'sync-score',
  name: 'Sync Score',
  description: 'Returns a deterministic synchronous score.',
}).generateScore(() => 1);

const asyncScorer = createScorer({
  id: 'async-score',
  name: 'Async Score',
  description: 'Returns a deterministic asynchronous score.',
}).generateScore(async () => {
  await Promise.resolve();
  return 0.75;
});

console.error('minimal experiment fixture initialized');

export const mastra = new Mastra({
  agents: { minimalAgent, mockedToolAgent, slowAgent },
  workflows: { resumableWorkflow },
  scorers: { syncScorer, asyncScorer },
});
