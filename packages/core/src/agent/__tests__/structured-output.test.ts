import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MastraModelGateway } from '../../llm/model/gateways/base';
import type { ProviderConfig } from '../../llm/model/gateways/base';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';

class StructuredOutputTestGateway extends MastraModelGateway {
  readonly id = 'structured-test';
  readonly name = 'structured-output-test-gateway';
  readonly prefix = 'structured-test';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'test-provider': {
        name: 'Test Provider',
        models: ['structuring-model'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: 'structured-output-test-gateway',
        url: 'https://api.test.com/v1',
      },
    };
  }

  buildUrl(_modelId: string): string {
    return 'https://api.test.com/v1';
  }

  async getApiKey(_modelId: string): Promise<string> {
    return process.env.TEST_API_KEY || 'test-key';
  }

  async resolveLanguageModel(_args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<MockLanguageModelV2> {
    return new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          { type: 'text', text: JSON.stringify({ summary: 'There are 3 files in the directory.', filesFound: 3 }) },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'structuring-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          {
            type: 'text-delta',
            id: 'text-1',
            delta: JSON.stringify({ summary: 'There are 3 files in the directory.', filesFound: 3 }),
          },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });
  }
}

function structuredOutputTests({ version }: { version: 'v1' | 'v2' | 'v3' }) {
  let zodSchemaModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;
  let jsonSchemaModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

  beforeEach(() => {
    if (version === 'v1') {
      // Mock for ZodSchema test - arrays must be wrapped in {"elements": [...]}
      zodSchemaModel = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: JSON.stringify({
            elements: [
              { year: '2012', winner: 'Barack Obama' },
              { year: '2016', winner: 'Donald Trump' },
            ],
          }),
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-delta', textDelta: '{ ' },
            { type: 'text-delta', textDelta: '"elements": ' },
            { type: 'text-delta', textDelta: '[' },
            { type: 'text-delta', textDelta: '{ "year": "2012", ' },
            { type: 'text-delta', textDelta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', textDelta: ', ' },
            { type: 'text-delta', textDelta: '{ "year": "2016", ' },
            { type: 'text-delta', textDelta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', textDelta: ']' },
            { type: 'text-delta', textDelta: ' }' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      // Mock for JSONSchema7 test - returns object with winners array
      jsonSchemaModel = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: JSON.stringify({
            winners: [
              { year: '2012', winner: 'Barack Obama' },
              { year: '2016', winner: 'Donald Trump' },
            ],
          }),
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-delta', textDelta: '{ ' },
            { type: 'text-delta', textDelta: '"winners": ' },
            { type: 'text-delta', textDelta: '[' },
            { type: 'text-delta', textDelta: '{ "year": "2012", ' },
            { type: 'text-delta', textDelta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', textDelta: ', ' },
            { type: 'text-delta', textDelta: '{ "year": "2016", ' },
            { type: 'text-delta', textDelta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', textDelta: ']' },
            { type: 'text-delta', textDelta: ' }' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });
    } else if (version === 'v2') {
      // V2 Mock for ZodSchema test - arrays must be wrapped in {"elements": [...]}
      zodSchemaModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                elements: [
                  { year: '2012', winner: 'Barack Obama' },
                  { year: '2016', winner: 'Donald Trump' },
                ],
              }),
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"elements": ' },
            { type: 'text-delta', id: 'text-1', delta: '[' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2012", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', id: 'text-1', delta: ', ' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2016", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', id: 'text-1', delta: ']' },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
            { type: 'text-end', id: 'text-1' },
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

      // V2 Mock for JSONSchema7 test
      jsonSchemaModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                winners: [
                  { year: '2012', winner: 'Barack Obama' },
                  { year: '2016', winner: 'Donald Trump' },
                ],
              }),
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"winners": ' },
            { type: 'text-delta', id: 'text-1', delta: '[' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2012", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', id: 'text-1', delta: ', ' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2016", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', id: 'text-1', delta: ']' },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
            { type: 'text-end', id: 'text-1' },
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
    } else {
      // V3 Mock for ZodSchema test - arrays must be wrapped in {"elements": [...]}
      zodSchemaModel = new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: 'stop',
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                elements: [
                  { year: '2012', winner: 'Barack Obama' },
                  { year: '2016', winner: 'Donald Trump' },
                ],
              }),
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"elements": ' },
            { type: 'text-delta', id: 'text-1', delta: '[' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2012", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', id: 'text-1', delta: ', ' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2016", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', id: 'text-1', delta: ']' },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 20, text: 20, reasoning: undefined },
              },
            },
          ]),
        }),
      });

      // V3 Mock for JSONSchema7 test
      jsonSchemaModel = new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: 'stop',
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                winners: [
                  { year: '2012', winner: 'Barack Obama' },
                  { year: '2016', winner: 'Donald Trump' },
                ],
              }),
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"winners": ' },
            { type: 'text-delta', id: 'text-1', delta: '[' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2012", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', id: 'text-1', delta: ', ' },
            { type: 'text-delta', id: 'text-1', delta: '{ "year": "2016", ' },
            { type: 'text-delta', id: 'text-1', delta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', id: 'text-1', delta: ']' },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 20, text: 20, reasoning: undefined },
              },
            },
          ]),
        }),
      });
    }
  });

  describe(`structured output ${version}`, () => {
    it('should support ZodSchema structured output type', async () => {
      const electionAgent = new Agent({
        id: 'us-election-agent',
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: zodSchemaModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;
      if (version === 'v1') {
        response = await agentOne.generateLegacy('Give me the winners of 2012 and 2016 US presidential elections', {
          output: z.array(
            z.object({
              winner: z.string(),
              year: z.string(),
            }),
          ),
        });
      } else {
        response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
          structuredOutput: {
            schema: z.array(
              z.object({
                winner: z.string(),
                year: z.string(),
              }),
            ),
          },
        });
      }

      expect(response.object.length).toBeGreaterThan(1);
      expect(response.object).toMatchObject([
        {
          year: '2012',
          winner: 'Barack Obama',
        },
        {
          year: '2016',
          winner: 'Donald Trump',
        },
      ]);
    });

    it('should support JSONSchema7 structured output type', async () => {
      const electionAgent = new Agent({
        id: 'us-election-agent',
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: jsonSchemaModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;
      if (version === 'v1') {
        response = await agentOne.generateLegacy('Give me the winners of 2012 and 2016 US presidential elections', {
          output: {
            type: 'object',
            properties: {
              winners: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { winner: { type: 'string' }, year: { type: 'string' } },
                  required: ['winner', 'year'],
                },
              },
            },
            required: ['winners'],
          },
        });
      } else {
        response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
          structuredOutput: {
            schema: {
              type: 'object',
              properties: {
                winners: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { winner: { type: 'string' }, year: { type: 'string' } },
                    required: ['winner', 'year'],
                  },
                },
              },
              required: ['winners'],
            },
          },
        });
      }

      expect(response.object.winners.length).toBeGreaterThan(1);
      expect(response.object.winners).toMatchObject([
        {
          year: '2012',
          winner: 'Barack Obama',
        },
        {
          year: '2016',
          winner: 'Donald Trump',
        },
      ]);
    });

    if (version === 'v2' || version === 'v3') {
      it('should use Mastra custom gateways for a separate structuring model', async () => {
        process.env.TEST_API_KEY = 'test-api-key-123';

        const primaryModel =
          version === 'v2'
            ? new MockLanguageModelV2({
                doGenerate: async () => ({
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  content: [{ type: 'text', text: 'There are 3 files in the directory.' }],
                  warnings: [],
                }),
                doStream: async () => ({
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  warnings: [],
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'There are 3 files in the directory.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                    },
                  ]),
                }),
              })
            : new MockLanguageModelV3({
                doGenerate: async () => ({
                  finishReason: 'stop' as const,
                  usage: {
                    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 20, text: 20, reasoning: undefined },
                  },
                  content: [{ type: 'text', text: 'There are 3 files in the directory.' }],
                  warnings: [],
                }),
                doStream: async () => ({
                  stream: convertArrayToReadableStreamV3([
                    { type: 'stream-start', warnings: [] },
                    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'There are 3 files in the directory.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: {
                        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                        outputTokens: { total: 20, text: 20, reasoning: undefined },
                      },
                    },
                  ]),
                }),
              });

        const agent = new Agent({
          id: `structured-output-custom-gateway-${version}`,
          name: 'Structured Output Custom Gateway',
          instructions: 'You are a helpful assistant.',
          model: primaryModel,
        });

        const mastra = new Mastra({
          agents: { agent },
          gateways: {
            structuredTest: new StructuredOutputTestGateway(),
          },
          logger: false,
        });

        const registeredAgent = mastra.getAgent('agent');

        const result = await registeredAgent.generate('Summarize: there are 3 files in the directory.', {
          structuredOutput: {
            schema: z.object({
              summary: z.string(),
              filesFound: z.number(),
            }),
            model: 'structured-test/test-provider/structuring-model',
          },
        });

        expect(result.tripwire).toBeUndefined();
        expect(result.object).toEqual({
          summary: 'There are 3 files in the directory.',
          filesFound: 3,
        });
      });

      it('should surface separate structuring model errors from the processor', async () => {
        const primaryModel =
          version === 'v2'
            ? new MockLanguageModelV2({
                doGenerate: async () => ({
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  content: [{ type: 'text', text: 'There are 3 files in the directory.' }],
                  warnings: [],
                }),
                doStream: async () => ({
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  warnings: [],
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'There are 3 files in the directory.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                    },
                  ]),
                }),
              })
            : new MockLanguageModelV3({
                doGenerate: async () => ({
                  finishReason: 'stop' as const,
                  usage: {
                    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 20, text: 20, reasoning: undefined },
                  },
                  content: [{ type: 'text', text: 'There are 3 files in the directory.' }],
                  warnings: [],
                }),
                doStream: async () => ({
                  stream: convertArrayToReadableStreamV3([
                    { type: 'stream-start', warnings: [] },
                    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'There are 3 files in the directory.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: {
                        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                        outputTokens: { total: 20, text: 20, reasoning: undefined },
                      },
                    },
                  ]),
                }),
              });

        const structuringError = new Error('No recording found for gpt-5.4');
        const structuringModel =
          version === 'v2'
            ? new MockLanguageModelV2({
                doStream: async () => {
                  throw structuringError;
                },
              })
            : new MockLanguageModelV3({
                doStream: async () => {
                  throw structuringError;
                },
              });

        const agent = new Agent({
          id: `structured-output-separate-model-error-${version}`,
          name: 'Structured Output Separate Model Error',
          instructions: 'You are a helpful assistant.',
          model: primaryModel,
        });

        const result = await agent.generate('Summarize: there are 3 files in the directory.', {
          structuredOutput: {
            schema: z.object({
              summary: z.string(),
              filesFound: z.number(),
            }),
            model: structuringModel,
          },
        });

        expect(result.object).toBeUndefined();
        expect(result.tripwire?.reason).toBe(
          '[StructuredOutputProcessor] Structured output processing failed: [StructuredOutputProcessor] Structuring failed: No recording found for gpt-5.4',
        );
      });

      it('should parse JSON from text field when object is undefined and finishReason is tool-calls (generate)', async () => {
        let bedrockStyleModel: MockLanguageModelV2 | MockLanguageModelV3;
        if (version === 'v2') {
          bedrockStyleModel = new MockLanguageModelV2({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    primitiveId: 'weatherAgent',
                    primitiveType: 'agent',
                    prompt: 'What is the weather?',
                    selectionReason: 'Selected for weather info',
                  }),
                },
              ],
              warnings: [],
            }),
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: JSON.stringify({
                    primitiveId: 'weatherAgent',
                    primitiveType: 'agent',
                    prompt: 'What is the weather?',
                    selectionReason: 'Selected for weather info',
                  }),
                },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });
        } else {
          bedrockStyleModel = new MockLanguageModelV3({
            doGenerate: async () => ({
              finishReason: 'tool-calls',
              usage: {
                inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 50, text: 50, reasoning: undefined },
              },
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    primitiveId: 'weatherAgent',
                    primitiveType: 'agent',
                    prompt: 'What is the weather?',
                    selectionReason: 'Selected for weather info',
                  }),
                },
              ],
              warnings: [],
            }),
            doStream: async () => ({
              stream: convertArrayToReadableStreamV3([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: 'text-1',
                  delta: JSON.stringify({
                    primitiveId: 'weatherAgent',
                    primitiveType: 'agent',
                    prompt: 'What is the weather?',
                    selectionReason: 'Selected for weather info',
                  }),
                },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: {
                    inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 50, text: 50, reasoning: undefined },
                  },
                },
              ]),
            }),
          });
        }

        const routingAgent = new Agent({
          id: 'routing-agent',
          name: 'routingAgent',
          instructions: 'Route requests to appropriate agents',
          model: bedrockStyleModel,
        });

        const responseSchema = z.object({
          primitiveId: z.string(),
          primitiveType: z.string(),
          prompt: z.string(),
          selectionReason: z.string(),
        });

        const result = await routingAgent.generate('What is the weather?', {
          structuredOutput: {
            schema: responseSchema,
          },
        });

        expect(result.object).toBeDefined();
        expect(result.object?.primitiveId).toBe('weatherAgent');
        expect(result.object?.primitiveType).toBe('agent');
        expect(result.object?.prompt).toBe('What is the weather?');
        expect(result.object?.selectionReason).toBe('Selected for weather info');
      });

      it('should parse JSON from text field when object is undefined and finishReason is tool-calls (stream)', async () => {
        let bedrockStyleModel: MockLanguageModelV2 | MockLanguageModelV3;
        if (version === 'v2') {
          bedrockStyleModel = new MockLanguageModelV2({
            doGenerate: async () => {
              throw new Error('Generate not needed for stream test');
            },
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: JSON.stringify({
                    primitiveId: 'weatherAgent',
                    primitiveType: 'agent',
                    prompt: 'What is the weather?',
                    selectionReason: 'Selected for weather info',
                  }),
                },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });
        } else {
          bedrockStyleModel = new MockLanguageModelV3({
            doGenerate: async () => {
              throw new Error('Generate not needed for stream test');
            },
            doStream: async () => ({
              stream: convertArrayToReadableStreamV3([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: 'text-1',
                  delta: JSON.stringify({
                    primitiveId: 'weatherAgent',
                    primitiveType: 'agent',
                    prompt: 'What is the weather?',
                    selectionReason: 'Selected for weather info',
                  }),
                },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: {
                    inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 50, text: 50, reasoning: undefined },
                  },
                },
              ]),
            }),
          });
        }

        const routingAgent = new Agent({
          id: 'routing-agent',
          name: 'Routing Agent',
          instructions: 'Route requests to appropriate agents',
          model: bedrockStyleModel,
        });

        const responseSchema = z.object({
          primitiveId: z.string(),
          primitiveType: z.string(),
          prompt: z.string(),
          selectionReason: z.string(),
        });

        const streamResult = await routingAgent.stream('What is the weather?', {
          structuredOutput: {
            schema: responseSchema,
          },
        });

        await streamResult.consumeStream();

        const finalObject = await streamResult.object;

        expect(finalObject).toBeDefined();
        expect(finalObject?.primitiveId).toBe('weatherAgent');
        expect(finalObject?.primitiveType).toBe('agent');
        expect(finalObject?.prompt).toBe('What is the weather?');
        expect(finalObject?.selectionReason).toBe('Selected for weather info');
      });
    }
  });
}

structuredOutputTests({ version: 'v1' });
structuredOutputTests({ version: 'v2' });
structuredOutputTests({ version: 'v3' });
