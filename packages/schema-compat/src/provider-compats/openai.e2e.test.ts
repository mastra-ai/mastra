import { openai } from '@ai-sdk/openai';
import { generateText, Output, jsonSchema, stepCountIs } from '@internal/ai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { standardSchemaToJSONSchema } from '../schema';
import { OpenAISchemaCompatLayer } from './openai';

enum TestEnum {
  A = 'A',
  B = 'B',
  C = 'C',
}

const allSchemas = {
  // String types
  string: z.string().describe('Sample text'),
  stringMin: z.string().min(5).describe('sample text with a minimum of 5 characters'),
  stringMax: z.string().max(10).describe('sample text with a maximum of 10 characters'),
  stringEmail: z.email().describe('a sample email address'),
  stringEmoji: z.emoji().describe('a valid sample emoji'),
  stringUrl: z.string().url().describe('a valid sample url'),

  // TODO: problematic for gemini-2.5-flash
  stringUuid: z.uuid().describe('a valid sample uuid'),
  stringCuid: z.cuid().describe('a valid sample cuid'),
  stringRegex: z
    .string()
    .regex(/^test-/)
    .describe('a valid sample string that satisfies the regex'),

  // Number types
  number: z.number().describe('any valid sample number'),
  numberGt: z.number().gt(3).describe('any valid sample number greater than 3'),
  numberLt: z.number().lt(6).describe('any valid sample number less than 6'),
  numberGte: z.number().gte(1).describe('any valid sample number greater than or equal to 1'),
  numberLte: z.number().lte(1).describe('any valid sample number less than or equal to 1'),
  numberMultipleOf: z.number().multipleOf(2).describe('any valid sample number that is a multiple of 2'),
  numberInt: z.number().int().describe('any valid sample number that is an integer'),

  // Array types
  exampleArray: z.array(z.string()).describe('any valid array of example strings'),
  arrayMin: z.array(z.string()).min(1).describe('any valid sample array of strings with a minimum of 1 string'),
  arrayMax: z.array(z.string()).max(5).describe('any valid sample array of strings with a maximum of 5 strings'),

  // Date type
  date: z.coerce.date().describe('a valid sample date'),
  dateAfter: z.coerce.date().min(new Date('2024-01-01')).describe('a valid sample date after 2024-01-01'),
  dateBefore: z.coerce.date().max(new Date()).describe('a valid sample date before today'),
  actualData: z.date().describe('a valid sample date'),

  // Object types
  object: z.object({ foo: z.string(), bar: z.number() }).describe('any valid sample object with a string and a number'),

  objectNested: z
    .object({
      user: z.object({
        name: z.string().min(2),
        age: z.number().gte(18),
      }),
    })
    .describe(`any valid sample data`),

  objectPassthrough: z.object({}).passthrough().describe('any sample object with example keys and data'),
  objectLoose: z.looseObject({}).describe('any sample object with example keys and data'),

  // Optional and nullable
  optional: z.string().optional().describe('leave this field empty as an example of an optional field'),
  nullable: z.string().nullable().describe('leave this field empty as an example of a nullable field'),

  // Enums
  enum: z.enum(['A', 'B', 'C']).describe('The letter A, B, or C'),
  nativeEnum: z.enum(TestEnum).describe('The letter A, B, or C'),

  // Union types
  unionPrimitives: z.union([z.string(), z.number()]).describe('sample text or number'),
  unionObjects: z
    .union([
      z.object({ amount: z.number(), inventoryItemName: z.string() }),
      z.object({ type: z.string(), permissions: z.array(z.string()) }),
    ])
    .describe('give an valid object'),

  // Default values
  default: z.string().default('test').describe('sample text that is the default value'),
} as const;

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

const expectedOutput = {
  string: expect.any(String),
  stringMin: expect.any(String),
  stringMax: expect.any(String),
  stringEmail: expect.any(String),
  stringEmoji: expect.any(String),
  stringUrl: expect.any(String),
  stringUuid: expect.any(String),
  stringCuid: expect.any(String),
  stringRegex: expect.any(String),
  number: expect.any(Number),
  numberGt: expect.any(Number),
  numberLt: expect.any(Number),
  numberGte: expect.any(Number),
  numberLte: expect.any(Number),
  numberMultipleOf: expect.any(Number),
  numberInt: expect.any(Number),
  exampleArray: expect.arrayContaining([expect.any(String)]),
  arrayMin: expect.arrayContaining([expect.any(String)]),
  arrayMax: expect.arrayContaining([expect.any(String)]),
  date: expect.any(Date),
  dateAfter: expect.any(Date),
  dateBefore: expect.any(Date),
  actualData: expect.any(Date),
  object: {
    foo: expect.any(String),
    bar: expect.any(Number),
  },
  objectNested: {
    user: {
      name: expect.any(String),
      age: expect.any(Number),
    },
  },
  objectPassthrough: expect.any(Object),
  objectLoose: expect.any(Object),
  optional: undefined,
  nullable: null,
  unionPrimitives: expect.toSatisfy(v => typeof v === 'string' || typeof v === 'number'),
  unionObjects: expect.toSatisfy(
    v => ('amount' in v && 'inventoryItemName' in v) || ('type' in v && 'permissions' in v),
  ),
  default: expect.any(String),
  enum: expect.stringMatching(/^[ABC]$/),
  nativeEnum: expect.stringMatching(/^[ABC]$/),
};

describe('OpenAI e2e test', () => {
  const mock = createGatewayMock({ exactMatch: true });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  it('should be succesful with structured_output', { timeout: 10000 }, async () => {
    const schema = z.object(allSchemas);

    const model = openai('gpt-4.1');

    const compat = new OpenAISchemaCompatLayer({
      provider: model.provider,
      modelId: model.modelId,
      supportsStructuredOutputs: true,
    });

    const compatSchema = compat.processToCompatSchema(schema);
    const compatJsonSchema = standardSchemaToJSONSchema(compatSchema);
    expect(compatJsonSchema).toMatchSnapshot();

    const result = await generateText({
      model,
      output: Output.object({
        schema: jsonSchema<z.infer<typeof schema>>(compatJsonSchema),
      }),
      prompt:
        'You are a test agent. Your task is to respond with valid JSON matching the schema provided. When a field is optional or nullable please mark it as null..',
    });

    expect(result.finishReason).toBe('stop');
    expect(result.output).toMatchObject({
      string: expect.any(String),
      stringMin: expect.any(String),
      stringMax: expect.any(String),
      stringEmail: expect.any(String),
      stringEmoji: expect.any(String),
      stringUrl: expect.any(String),
      stringUuid: expect.any(String),
      stringCuid: expect.any(String),
      stringRegex: expect.any(String),
      number: expect.any(Number),
      numberGt: expect.any(Number),
      numberLt: expect.any(Number),
      numberGte: expect.any(Number),
      numberLte: expect.any(Number),
      numberMultipleOf: expect.any(Number),
      numberInt: expect.any(Number),
      exampleArray: expect.arrayContaining([expect.any(String)]),
      arrayMin: expect.arrayContaining([expect.any(String)]),
      arrayMax: expect.arrayContaining([expect.any(String)]),
      date: expect.any(String),
      dateAfter: expect.any(String),
      dateBefore: expect.any(String),
      object: {
        foo: expect.any(String),
        bar: expect.any(Number),
      },
      objectNested: {
        user: {
          name: expect.any(String),
          age: expect.any(Number),
        },
      },
      enum: expect.stringMatching(/^[ABC]$/),
      nativeEnum: expect.stringMatching(/^[ABC]$/),
      optional: null,
      default: expect.any(String),
    });
    expect(compatSchema['~standard'].validate(result.output)).toMatchSnapshot();
  });

  it('should handle tool call with manySchemas input', { timeout: 60_000 }, async () => {
    const schema = z.object(allSchemas);
    const model = openai('gpt-4.1');

    const compat = new OpenAISchemaCompatLayer({
      provider: model.provider,
      modelId: model.modelId,
      supportsStructuredOutputs: true,
    });

    const compatSchema = compat.processToCompatSchema(schema);
    const compatJsonSchema = standardSchemaToJSONSchema(compatSchema);

    const result = await generateText({
      model,
      tools: {
        manySchemasTool: {
          description:
            'A test tool. Call this tool with valid data matching the schema. If the schema is optional or nullable, please mark it as null.',
          inputSchema: jsonSchema<z.infer<typeof schema>>(compatJsonSchema),
          execute: async (input: z.infer<typeof schema>) => input,
        },
      },
      toolChoice: 'auto' as const,
      stopWhen: stepCountIs(2),
      prompt: 'Call the manySchemasTool tool with valid sample data.',
    });

    const toolCall = result.steps[0].toolCalls[0];
    expect(toolCall).toBeDefined();
    expect(toolCall.toolName).toBe('manySchemasTool');
    expect(toolCall.input).toMatchObject({
      ...expectedOutput,
      date: expect.any(String),
      dateAfter: expect.any(String),
      dateBefore: expect.any(String),
      actualData: expect.any(String),
      optional: null,
    });
    expect(compatSchema['~standard'].validate(toolCall.input)).toMatchSnapshot();
  });

  it('should handle tool call with manySchemas input and output', { timeout: 60_000 }, async () => {
    const schema = z.object(allSchemas);
    const model = openai('gpt-4.1');

    const compat = new OpenAISchemaCompatLayer({
      provider: model.provider,
      modelId: model.modelId,
      supportsStructuredOutputs: true,
    });

    const compatSchema = compat.processToCompatSchema(schema);
    const compatJsonSchema = standardSchemaToJSONSchema(compatSchema);

    const result = await generateText({
      model,
      tools: {
        manySchemasTool: {
          description:
            'A test tool. Call this tool with valid data matching the schema. If the schema is optional or nullable, please mark it as null.',
          inputSchema: jsonSchema<z.infer<typeof schema>>(compatJsonSchema),
          outputSchema: jsonSchema<z.infer<typeof schema>>(compatJsonSchema),
          execute: async (input: z.infer<typeof schema>) => {
            const result = await compatSchema['~standard'].validate(input);
            if ('issues' in result && result.issues) {
              throw new Error(result.issues.map((i: any) => i.message).join(', '));
            }

            return (result as { value: z.infer<typeof schema> }).value;
          },
        },
      },
      toolChoice: 'auto' as const,
      stopWhen: stepCountIs(2),
      prompt: 'Call the manySchemasTool tool with valid sample data and return the validated tool output.',
    });

    const toolResult = result.steps[0].toolResults[0];
    expect(toolResult).toBeDefined();
    expect(toolResult.toolName).toBe('manySchemasTool');
    expect(toolResult.output).toMatchObject(expectedOutput);
    expect(result.text).toMatchSnapshot();
  });
});
