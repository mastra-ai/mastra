/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/19605.
 *
 * A *user-supplied* workflow used as an output processor is executed once per streamed
 * chunk, with the full accumulated `streamParts` as input. Unlike the agent's internal
 * processor workflow, a user workflow keeps the default `shouldPersistSnapshot: () => true`,
 * so every one of those transient per-chunk runs persisted a snapshot whose payload grew
 * with the stream — O(n^2) storage writes and serialized payload for an n-chunk response.
 *
 * The invariant: the storage cost of streaming through a workflow output processor must not
 * scale with the number of streamed chunks, while the processor still sees every chunk and
 * the text is emitted unchanged. The same workflow started directly by the user must keep
 * persisting normally.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

const AGENT_ID = 'stream-processor-agent';
const PROCESSOR_WORKFLOW_ID = 'noop-processor-workflow';

function expectedText(chunkCount: number) {
  return Array.from({ length: chunkCount }, (_, i) => `chunk${i} `).join('');
}

function createStreamingModel(chunkCount: number) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...Array.from({ length: chunkCount }, (_, i) => ({
          type: 'text-delta' as const,
          id: 'text-1',
          delta: `chunk${i} `,
        })),
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    }),
  });
}

/**
 * A workflow shaped like the one in the issue: a no-op step wired straight through, so it
 * can be handed to `outputProcessors` as-is.
 */
function buildProcessorWorkflow() {
  const noop = createStep({
    id: 'noop',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData }) => inputData,
  });

  return createWorkflow({
    id: PROCESSOR_WORKFLOW_ID,
    inputSchema: z.any(),
    outputSchema: z.any(),
  })
    .then(noop)
    .commit();
}

function buildAgent(chunkCount: number) {
  const storage = new InMemoryStore();
  const workflow = buildProcessorWorkflow();
  const agent = new Agent({
    id: AGENT_ID,
    name: AGENT_ID,
    instructions: 'test',
    model: createStreamingModel(chunkCount),
    outputProcessors: [workflow as any],
  });
  const mastra = new Mastra({
    agents: { [AGENT_ID]: agent },
    workflows: { [PROCESSOR_WORKFLOW_ID]: workflow },
    storage,
    logger: false,
  });
  return { mastra, storage, workflow };
}

async function countPersistedRuns(storage: InMemoryStore) {
  const workflowsStore = await storage.getStore('workflows');
  return (await workflowsStore!.listWorkflowRuns({ workflowName: PROCESSOR_WORKFLOW_ID })).total;
}

async function streamThroughProcessor(chunkCount: number) {
  const { mastra, storage } = buildAgent(chunkCount);

  const stream = await mastra.getAgent(AGENT_ID).stream('Write an essay.');
  let text = '';
  for await (const chunk of stream.textStream) {
    text += chunk;
  }

  return { text, persistedRuns: await countPersistedRuns(storage) };
}

describe('workflow used as an output processor (issue #19605)', () => {
  it('persists the same number of runs regardless of how many chunks are streamed', async () => {
    const short = await streamThroughProcessor(5);
    const long = await streamThroughProcessor(80);

    expect(short.text).toBe(expectedText(5));
    expect(long.text).toBe(expectedText(80));

    // Per-chunk runs must persist nothing; only the non-streaming output phases may.
    expect(long.persistedRuns).toBe(short.persistedRuns);
    expect(long.persistedRuns).toBeLessThanOrEqual(2);
  });

  it('still persists when the same workflow is started directly by the user', async () => {
    const { storage, workflow } = buildAgent(5);

    const run = await workflow.createRun();
    await run.start({ inputData: { hello: 'world' } });

    expect(await countPersistedRuns(storage)).toBeGreaterThan(0);
  });
});
