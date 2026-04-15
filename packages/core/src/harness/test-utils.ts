import type { PassThrough } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import type { FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';

export function createMockFullOutput(overrides: Partial<FullOutput<any>> = {}): FullOutput<any> {
  return {
    text: 'Hello world',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    steps: [{ text: 'Hello world' } as any],
    finishReason: 'end_turn' as any,
    warnings: [],
    providerMetadata: undefined as any,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { modelId: 'test-model', id: '1', timestamp: new Date(), messages: [], uiMessages: [] } as any,
    totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    object: undefined,
    error: undefined,
    tripwire: undefined,
    traceId: 'trace-123',
    spanId: 'span-456',
    runId: 'run-789',
    suspendPayload: undefined,
    resumeSchema: undefined,
    messages: [],
    rememberedMessages: [],
    ...overrides,
  };
}

export function createMockStreamOutput(chunks: ChunkType<any>[], fullOutput: FullOutput<any>) {
  const fullStream = new ReadableStream<ChunkType<any>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return {
    fullStream,
    getFullOutput: async () => fullOutput,
  } as any;
}

export async function collectStream(stream: PassThrough): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
