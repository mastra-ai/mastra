import { z } from 'zod';
import { mastra } from './mastra';

// Recursively check if any field at any level is optional
type HasOptionalFieldsDeep<T> = T extends object
  ? true extends {
      [K in keyof T]-?: {} extends Pick<T, K>
        ? true // This key is optional
        : T[K] extends object
          ? HasOptionalFieldsDeep<T[K]> // Recurse into nested objects
          : false;
    }[keyof T]
    ? true
    : false
  : false;

// Get all paths to optional fields (including nested)
type OptionalPaths<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T]-?: {} extends Pick<T, K>
        ? `${Prefix}${K & string}` // This key is optional
        : T[K] extends object
          ? OptionalPaths<T[K], `${Prefix}${K & string}.`> // Recurse with path
          : never;
    }[keyof T]
  : never;

const agent = mastra.getAgent('helpfulAgent');

const schema = z.object({
  title: z.string().describe('The title of the story'),
  summary: z.string().describe('The summary of the story'),
  author: z.string().describe('The author of the story').optional(),
  readingTimeEstimate: z.number().describe('The reading time estimate of the story in minutes'),
  readingLevel: z.enum(['easy', 'medium', 'hard']).describe('The reading level of the story'),
  data: z.object({
    somethingElse: z.string().optional(),
  }),
});

type MySchema = z.infer<typeof schema>;
type HasOptionals = HasOptionalFieldsDeep<MySchema>;
type AllOptionalPaths = OptionalPaths<MySchema>;

const result = await agent.stream(
  'Write me an interesting short story. Leave the author blank. Do not include an author at all.',
  {
    structuredOutput: {
      // model: 'openai/gpt-4o-mini',
      schema,
      // maxValidationRetries: 3,
      // retryOnValidationError: false,
      errorStrategy: 'strict' as const,
    },
  },
);

for await (const chunk of result.fullStream) {
  if (chunk.type === 'object') {
    console.log('object', chunk.object);
  }
  if (chunk.type === 'step-start') {
    console.log('step-start', chunk);
  }
  // if (chunk.type === 'step-finish') {
  // console.log('step-finish chunk.payload.output.validationRetry', chunk.payload.output.validationRetry);
  // console.log('step-finish', chunk.payload.output.validationRetry);
  // }
}

const finalObjectResult = await result.object;
console.log('finalObjectResult', finalObjectResult);
