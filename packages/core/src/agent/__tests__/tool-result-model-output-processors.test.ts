/**
 * processToolResult and `toModelOutput` (both engines).
 *
 * A tool's `toModelOutput` mapping (e.g. a file-view tool turning its result
 * into image parts) is what the next model call and stored history read. An
 * output processor's `processToolResult` must be able to see that mapped
 * output and rewrite it, images included, before it is stored and before the
 * next prompt is built. Otherwise a guard that shrinks, tiles or removes
 * oversized images only changes the raw result, and the original images still
 * reach the model and memory.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor, ProcessToolResultArgs } from '../../processors';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

const b64 = (s: string) => Buffer.from(s).toString('base64');
const ORIGINAL = b64('original oversized 780x9606 screenshot');
const TILE_1 = b64('tile one 209x2576');
const TILE_2 = b64('tile two 209x2576');
const NOTE = 'Image removed: 780x9606 exceeds the 2576px limit.';

function createToolCallingModel(prompts: unknown[]) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'tool-call', toolCallId: 'view-call', toolName: 'view', input: '{"path":"shot.png"}' },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function createViewTool(mapCalls: unknown[]) {
  return createTool({
    id: 'view',
    description: 'View a file',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => ({ path, image: ORIGINAL }),
    toModelOutput: (output: unknown) => {
      mapCalls.push(output);
      const { path, image } = output as { path: string; image?: string };
      return {
        type: 'content',
        value: [
          { type: 'text', text: `Viewing ${path}` },
          ...(image ? [{ type: 'media', data: image, mediaType: 'image/png' }] : []),
        ],
      };
    },
  });
}

type RewriteCase = {
  name: string;
  rewrite: (modelOutput: any) => unknown;
  expectInPrompt: string[];
};

const rewriteCases: RewriteCase[] = [
  {
    name: 'tile',
    rewrite: modelOutput => ({
      type: 'content',
      value: [
        modelOutput.value[0],
        { type: 'media', data: TILE_1, mediaType: 'image/png' },
        { type: 'media', data: TILE_2, mediaType: 'image/png' },
      ],
    }),
    expectInPrompt: [TILE_1, TILE_2],
  },
  {
    name: 'note',
    rewrite: modelOutput => ({ type: 'content', value: [modelOutput.value[0], { type: 'text', text: NOTE }] }),
    expectInPrompt: [NOTE],
  },
];

/** Rewrites the mapped model output through the existing messageList API. */
class ModelOutputRewriter implements Processor {
  readonly id = 'model-output-rewriter';
  seen: unknown[] = [];
  constructor(private readonly rewrite: (modelOutput: unknown) => unknown) {}
  processToolResult({ messageList, toolCallId, toolName, args, result, modelOutput }: ProcessToolResultArgs) {
    this.seen.push(modelOutput);
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName, args, result },
      providerMetadata: { mastra: { modelOutput: this.rewrite(modelOutput) as any } },
    });
  }
}

/** Rewrites only the raw result, the way a redaction processor does. */
class RawResultRewriter implements Processor {
  readonly id = 'raw-result-rewriter';
  processToolResult({ messageList, toolCallId, toolName, args }: ProcessToolResultArgs) {
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName, args, result: { path: 'shot.png', image: TILE_1 } },
    });
  }
}

const engines = ['agent', 'durable'] as const;

function toolMessage(prompt: any): string {
  return JSON.stringify((prompt as any[]).filter(m => m.role === 'tool'));
}

describe.each(engines)('processToolResult sees and rewrites toModelOutput (%s engine)', engine => {
  let pubsub: EventEmitterPubSub;
  let memory: MockMemory;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    memory = new MockMemory();
  });

  afterEach(async () => {
    await pubsub.close?.();
  });

  async function run(processor: Processor | Processor[], thread: string) {
    const prompts: unknown[] = [];
    const mapCalls: unknown[] = [];
    const id = `model-output-${engine}-${thread}`;
    const baseAgent = new Agent({
      id,
      name: id,
      instructions: 'View the file, then answer.',
      model: createToolCallingModel(prompts) as LanguageModelV2,
      tools: { view: createViewTool(mapCalls) },
      memory,
      outputProcessors: Array.isArray(processor) ? processor : [processor],
    });
    const agent = engine === 'durable' ? createDurableAgent({ agent: baseAgent, pubsub }) : baseAgent;
    new Mastra({ agents: { [id]: agent as any }, logger: false, storage: new InMemoryStore(), pubsub });

    const result = await (agent as Agent).stream('Look at shot.png', {
      maxSteps: 3,
      memory: { thread, resource: 'resource-1' },
    });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);
    (result as { cleanup?: () => void }).cleanup?.();

    const recalled = await memory.recall({ threadId: thread, resourceId: 'resource-1' });
    return { prompts, mapCalls, chunks, stored: JSON.stringify(recalled.messages) };
  }

  it.each(rewriteCases)(
    '$name: the rewritten output reaches the next prompt and storage',
    async ({ name, rewrite, expectInPrompt }) => {
      const processor = new ModelOutputRewriter(rewrite);
      const { prompts, chunks, stored } = await run(processor, `thread-${name}`);

      // The processor saw the mapped output, original image included.
      expect(processor.seen).toHaveLength(1);
      expect(JSON.stringify(processor.seen[0])).toContain(ORIGINAL);

      // The next model call reads the rewritten output, never the original image.
      expect(prompts).toHaveLength(2);
      const nextToolMessage = toolMessage(prompts[1]);
      for (const expected of expectInPrompt) expect(nextToolMessage).toContain(expected);
      expect(nextToolMessage).not.toContain(ORIGINAL);

      // Stored history (what memory and Observational Memory read) has no original image in the model output.
      const storedModelOutput = JSON.stringify(
        JSON.parse(stored).flatMap((m: any) =>
          (m.content?.parts ?? []).map((p: any) => p.providerMetadata?.mastra?.modelOutput),
        ),
      );
      for (const expected of expectInPrompt) expect(storedModelOutput).toContain(expected);
      expect(storedModelOutput).not.toContain(ORIGINAL);

      // Streaming clients see the same model output.
      const toolResult = chunks.find(c => c.type === 'tool-result');
      const streamedModelOutput = JSON.stringify(toolResult?.payload?.providerMetadata?.mastra?.modelOutput);
      for (const expected of expectInPrompt) expect(streamedModelOutput).toContain(expected);
      expect(streamedModelOutput).not.toContain(ORIGINAL);
    },
  );

  it('remaps the rewritten raw result when a processor changes only the result', async () => {
    const { prompts, mapCalls } = await run(new RawResultRewriter(), 'thread-raw');

    const nextToolMessage = toolMessage(prompts[1]);
    expect(nextToolMessage).toContain(TILE_1);
    expect(nextToolMessage).not.toContain(ORIGINAL);
    expect(mapCalls).toHaveLength(2);
  });

  it('remaps a result a processor edited in place, committed or not', async () => {
    for (const commit of [false, true]) {
      const { prompts, mapCalls } = await run(
        {
          id: 'in-place-editor',
          processToolResult: ({ messageList, toolCallId, toolName, args, result }: ProcessToolResultArgs) => {
            (result as { image: string }).image = TILE_1;
            if (commit) {
              messageList.updateToolInvocation({
                type: 'tool-invocation',
                toolInvocation: { state: 'result', toolCallId, toolName, args, result },
              });
            }
          },
        },
        `thread-in-place-${commit}`,
      );

      const nextToolMessage = toolMessage(prompts[1]);
      expect(nextToolMessage).toContain(TILE_1);
      expect(nextToolMessage).not.toContain(ORIGINAL);
      expect(mapCalls).toHaveLength(2);
    }
  });

  it('gives each processor the mapping the processor before it committed', async () => {
    const tiler = new ModelOutputRewriter(rewriteCases[0]!.rewrite);
    const next = new ModelOutputRewriter(modelOutput => modelOutput);
    const { prompts } = await run([tiler, next], 'thread-chain');

    expect(JSON.stringify(tiler.seen[0])).toContain(ORIGINAL);
    expect(JSON.stringify(next.seen[0])).toContain(TILE_1);
    expect(JSON.stringify(next.seen[0])).not.toContain(ORIGINAL);
    expect(toolMessage(prompts[1])).not.toContain(ORIGINAL);
  });

  it('gives the next processor no mapping once an earlier processor clears it', async () => {
    const clearer = new ModelOutputRewriter(() => null);
    const next = new ModelOutputRewriter(modelOutput => modelOutput);
    const { prompts } = await run([clearer, next], 'thread-chain-clear');

    expect(JSON.stringify(clearer.seen[0])).toContain(ORIGINAL);
    expect(next.seen[0]).toBeUndefined();
    expect(prompts).toHaveLength(2);
  });

  it('maps once and keeps the mapped output when a processor changes nothing', async () => {
    const observed: unknown[] = [];
    const { prompts, mapCalls } = await run(
      {
        id: 'observer',
        processToolResult: ({ modelOutput }: ProcessToolResultArgs) => {
          observed.push(modelOutput);
        },
      },
      'thread-noop',
    );

    expect(mapCalls).toHaveLength(1);
    expect(JSON.stringify(observed[0])).toContain(ORIGINAL);
    expect(toolMessage(prompts[1])).toContain(ORIGINAL);
  });
});

describe('durable engine: a failing processToolResult', () => {
  it('keeps the unprocessed mapped output from the next prompt and storage', async () => {
    const pubsub = new EventEmitterPubSub();
    const memory = new MockMemory();
    const prompts: unknown[] = [];
    const id = 'model-output-durable-fail-closed';
    const baseAgent = new Agent({
      id,
      name: id,
      instructions: 'View the file, then answer.',
      model: createToolCallingModel(prompts) as LanguageModelV2,
      tools: { view: createViewTool([]) },
      memory,
      outputProcessors: [
        {
          id: 'failing-guard',
          processToolResult: () => {
            throw new Error('guard failed');
          },
        },
      ],
    });
    const agent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({ agents: { [id]: agent as any }, logger: false, storage: new InMemoryStore(), pubsub });

    const result = await agent.stream('Look at shot.png', {
      maxSteps: 3,
      memory: { thread: 'thread-fail', resource: 'resource-1' },
    });
    for await (const _chunk of result.fullStream) {
      // drain
    }
    result.cleanup();

    expect(prompts).toHaveLength(2);
    expect(toolMessage(prompts[1])).not.toContain(ORIGINAL);
    const recalled = await memory.recall({ threadId: 'thread-fail', resourceId: 'resource-1' });
    expect(JSON.stringify(recalled.messages)).not.toContain(ORIGINAL);
    await pubsub.close?.();
  });
});
