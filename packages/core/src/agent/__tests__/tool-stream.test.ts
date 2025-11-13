import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import type { AIV5FullStreamPart } from '../../stream/aisdk/v5/output';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

describe('Writable Stream from Tool', () => {
  let mockElectionModel: MockLanguageModelV2;

  beforeEach(() => {
    mockElectionModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-election-1',
            toolName: 'election-tool',
            input: '{"year": 2016}',
            providerExecuted: false,
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'According to the election-tool, ' },
          { type: 'text-delta', id: '1', delta: 'Donald Trump won the 2016 election.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
  });

  it('should get a text response from the agent', async () => {
    const tool = createTool({
      description: 'A tool that returns the winner of the 2016 US presidential election',
      id: 'election-tool',
      inputSchema: z.object({
        year: z.number(),
      }),
      execute: async (inputData, context) => {
        context?.writer?.write({
          type: 'election-data',
          args: {
            year: inputData.year,
          },
          status: 'pending',
        });

        await delay(1000);

        context?.writer?.write({
          type: 'election-data',
          args: {
            year: inputData.year,
          },
          result: {
            winner: 'Donald Trump',
          },
          status: 'success',
        });

        return { winner: 'Donald Trump' };
      },
    });

    const electionAgent = new Agent({
      id: 'us-election-agent',
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: mockElectionModel,
      tools: {
        electionTool: tool,
      },
    });

    const mastraStream = await electionAgent.stream('Call the election-tool and tell me what it says.');

    const chunks: ChunkType[] = [];
    for await (const chunk of mastraStream.fullStream) {
      chunks.push(chunk);
    }

    expect(chunks.find(chunk => chunk.type === 'tool-output')).toBeDefined();

    const aiSdkParts: AIV5FullStreamPart[] = [];

    const aiSdkStream = await electionAgent.stream('Call the election-tool and tell me what it says.', {
      format: 'aisdk',
    });

    for await (const chunk of aiSdkStream.fullStream) {
      aiSdkParts.push(chunk);
    }

    // our types are broken, we do output these tool-output types when a tool writes
    // but adding this to the ai sdk output stream part types breaks 100 other types
    // so cast as any
    const toolOutputChunk = aiSdkParts.find((chunk: any) => chunk.type === 'tool-output');

    expect(toolOutputChunk).toBeDefined();
  });
});
