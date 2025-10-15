import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestIntegration } from '../../integration/openapi-toolset.mock';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';

function toolsTest(version: 'v1' | 'v2') {
  const integration = new TestIntegration();
  let mockModel: MockLanguageModelV1 | MockLanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      mockModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: undefined,
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              args: JSON.stringify({}),
            },
          ],
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-test-1',
                toolName: 'testTool',
                args: JSON.stringify({}),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });
    } else {
      mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [],
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              args: {},
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              input: '{}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });
    }
  });

  describe(`agents using tools ${version}`, () => {
    it('should call testTool from TestIntegration', async () => {
      const testAgent = new Agent({
        name: 'Test agent',
        instructions: 'You are an agent that call testTool',
        model: mockModel,
        tools: integration.getStaticTools(),
      });

      const mastra = new Mastra({
        agents: {
          testAgent,
        },
        logger: false,
      });

      const agentOne = mastra.getAgent('testAgent');

      let response;
      let toolCall;

      if (version === 'v1') {
        response = await agentOne.generateLegacy('Call testTool', {
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'testTool');
      } else {
        response = await agentOne.generate('Call testTool');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'testTool').payload;
      }

      const message = toolCall?.result?.message;

      expect(message).toBe('Executed successfully');
    });
  });
}

toolsTest('v1');
toolsTest('v2');
