import { MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';

function structuredOutputTests({ version }: { version: 'v1' | 'v2' }) {
  let zodSchemaModel: MockLanguageModelV1 | MockLanguageModelV2;
  let jsonSchemaModel: MockLanguageModelV1 | MockLanguageModelV2;

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
    } else {
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
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"elements": ' },
            { type: 'text-delta', id: '1', delta: '[' },
            { type: 'text-delta', id: '1', delta: '{ "year": "2012", ' },
            { type: 'text-delta', id: '1', delta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: '{ "year": "2016", ' },
            { type: 'text-delta', id: '1', delta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', id: '1', delta: ']' },
            { type: 'text-delta', id: '1', delta: ' }' },
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
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"winners": ' },
            { type: 'text-delta', id: '1', delta: '[' },
            { type: 'text-delta', id: '1', delta: '{ "year": "2012", ' },
            { type: 'text-delta', id: '1', delta: '"winner": "Barack Obama" }' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: '{ "year": "2016", ' },
            { type: 'text-delta', id: '1', delta: '"winner": "Donald Trump" }' },
            { type: 'text-delta', id: '1', delta: ']' },
            { type: 'text-delta', id: '1', delta: ' }' },
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

    if (version === 'v2') {
      it('should parse JSON from text field when object is undefined and finishReason is tool-calls (generate)', async () => {
        const bedrockStyleModel = new MockLanguageModelV2({
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
              { type: 'text-start', id: '1' },
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
              { type: 'text-end', id: '1' },
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
        const bedrockStyleModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw new Error('Generate not needed for stream test');
          },
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
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
              { type: 'text-end', id: '1' },
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
