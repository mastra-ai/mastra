import { expectTypeOf, describe, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { type FullOutput, MastraModelOutput, MastraAgentNetworkStream } from '@mastra/core/stream';
import type { GenerateTextResult, GenerateObjectResult, StreamTextResult, StreamObjectResult } from '@mastra/core/llm';
import { openai as openaiV4 } from 'openai-v4';
import { openai as openaiV5 } from 'openai-v5';
import { z as zv3 } from 'zod-v3';
import { z as zv4 } from 'zod-v4';

// Extract the model property type from Agent constructor parameters
type AgentConstructorParams = ConstructorParameters<typeof Agent>[0];
type ModelType = AgentConstructorParams['model'];

// Create test agent instances
const agent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-4o',
});

const sentimentSchema = zv3.object({
  sentiment: zv3.enum(['positive', 'negative', 'neutral']),
  confidence: zv3.number(),
});

const sentimentSchemaV4 = zv4.object({
  sentiment: zv4.enum(['positive', 'negative', 'neutral']),
  confidence: zv4.number(),
});

describe('Constructor', () => {
  describe('model', () => {
    it('should be typed', () => {
      expectTypeOf<ModelType>().not.toBeAny();
    });
    it('should accept a v1 model', () => {
      // Explicitly test that openai("gpt-4o") is assignable to the model parameter type
      expectTypeOf(openaiV4('gpt-4o')).toExtend<ModelType>();
    });

    it('should accept a v2 model', () => {
      // Explicitly test that openai("gpt-4o") is assignable to the model parameter type
      expectTypeOf(openaiV5('gpt-4o')).toExtend<ModelType>();
    });

    it('should accept a model router model', () => {
      // Explicitly test that openai("gpt-4o") is assignable to the model parameter type
      expectTypeOf('openai/gpt-4o').toExtend<ModelType>();
    });

    it('should not accept a random object', () => {
      expectTypeOf({}).not.toEqualTypeOf<ModelType>();
    });
  });
});

describe('Agent with defaultOption', () => {
  // Create an agent with a typed TOutput via the generic parameter (zod v3)
  const typedOutputSchema = zv3.object({
    answer: zv3.string(),
    confidence: zv3.number(),
    sources: zv3.array(zv3.string()),
  });

  type TypedOutput = zv3.infer<typeof typedOutputSchema>;

  const typedAgent = new Agent<'typed-agent', {}, TypedOutput>({
    id: 'typed-agent',
    name: 'Typed Agent',
    instructions: 'You are helpful',
    model: 'openai/gpt-4o',
    defaultOptions: {
      structuredOutput: {
        schema: typedOutputSchema,
      },
    },
  });

  describe('generate with TOutput', () => {
    it('should infer TOutput from agent generic when no structuredOutput is passed', async () => {
      const result = await typedAgent.generate('What is the answer?');
      expectTypeOf(result).toEqualTypeOf<FullOutput<TypedOutput>>();
      expectTypeOf(result.object).toExtend<TypedOutput>();
    });

    it('should override TOutput when structuredOutput is explicitly provided', async () => {
      const overrideSchema = zv3.object({
        customField: zv3.boolean(),
      });

      const result = await typedAgent.generate('Override', {
        structuredOutput: { schema: overrideSchema },
      });

      expectTypeOf(result).toEqualTypeOf<FullOutput<{ customField: boolean }>>();
      expectTypeOf(result.object).toExtend<{ customField: boolean }>();
    });
  });

  describe('stream with defaultOption', () => {
    it('should infer TOutput from agent generic when no structuredOutput is passed', async () => {
      const result = await typedAgent.stream('What is the answer?');
      expectTypeOf(result).toEqualTypeOf<MastraModelOutput<TypedOutput>>();
    });

    it('should override TOutput when structuredOutput is explicitly provided', async () => {
      const overrideSchema = zv3.object({
        streamedField: zv3.string(),
      });

      const result = await typedAgent.stream('Override', {
        structuredOutput: { schema: overrideSchema },
      });

      expectTypeOf(result).toEqualTypeOf<MastraModelOutput<{ streamedField: string }>>();
    });

    it('should provide correctly typed object from getFullOutput', async () => {
      const result = await typedAgent.stream('Get answer');
      const output = await result.getFullOutput();

      expectTypeOf(output.object).toExtend<TypedOutput>();
    });
  });

  describe('network with defaultOption', () => {
    it('should infer TOutput from agent generic when no structuredOutput is passed', async () => {
      const result = await typedAgent.network('Analyze this');
      expectTypeOf(result).toEqualTypeOf<MastraAgentNetworkStream<TypedOutput>>();
    });

    it('should override TOutput when structuredOutput is explicitly provided', async () => {
      const overrideSchema = zv3.object({
        networkResult: zv3.string(),
      });

      const result = await typedAgent.network('Override', {
        structuredOutput: { schema: overrideSchema },
      });

      expectTypeOf(result).toEqualTypeOf<MastraAgentNetworkStream<{ networkResult: string }>>();
    });

    it('should provide correctly typed object promise', async () => {
      const result = await typedAgent.network('Get answer');
      const obj = await result.object;

      expectTypeOf(obj).toExtend<TypedOutput>();
    });
  });

  // Test with zod v4 schema
  describe('Agent with defaultOption(zod-v4)', () => {
    const typedOutputSchemaV4 = zv4.object({
      result: zv4.string(),
      score: zv4.number(),
    });

    type TypedOutputV4 = zv4.infer<typeof typedOutputSchemaV4>;

    const typedAgentV4 = new Agent<'typed-agent-v4', {}, TypedOutputV4>({
      id: 'typed-agent-v4',
      name: 'Typed Agent V4',
      instructions: 'You are helpful',
      model: 'openai/gpt-4o',
      defaultOptions: {
        structuredOutput: {
          schema: typedOutputSchemaV4,
        },
      },
    });

    it('should infer TOutput from zod v4 schema in generate', async () => {
      const result = await typedAgentV4.generate('Get result');
      expectTypeOf(result).toEqualTypeOf<FullOutput<TypedOutputV4>>();
      expectTypeOf(result.object).toExtend<{ result: string; score: number }>();
    });

    it('should infer TOutput from zod v4 schema in stream', async () => {
      const result = await typedAgentV4.stream('Get result');
      expectTypeOf(result).toEqualTypeOf<MastraModelOutput<TypedOutputV4>>();
    });

    it('should infer TOutput from zod v4 schema in network', async () => {
      const result = await typedAgentV4.network('Get result');
      expectTypeOf(result).toEqualTypeOf<MastraAgentNetworkStream<TypedOutputV4>>();
    });
  });
});

describe('generate', () => {
  it('should return FullOutput<undefined> when called without structuredOutput', async () => {
    const result = await agent.generate('Hello');
    expectTypeOf(result).toEqualTypeOf<FullOutput<undefined>>();
    expectTypeOf(result.text).toBeString();
    expectTypeOf(result.object).toEqualTypeOf<undefined>();
  });

  it('should return FullOutput<OUTPUT> when structuredOutput is provided', async () => {
    const result = await agent.generate('Hello', {
      structuredOutput: {
        schema: sentimentSchema,
      },
    });
    expectTypeOf(result).toEqualTypeOf<
      FullOutput<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
    >();
    // object can be the output type or undefined
    expectTypeOf(result.object).toExtend<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>();
  });

  it('should infer OUTPUT type from structuredOutput schema (zod v3)', async () => {
    const customSchema = zv3.object({
      items: zv3.array(zv3.string()),
      count: zv3.number(),
    });

    const result = await agent.generate('List items', {
      structuredOutput: { schema: customSchema },
    });

    // object can be the output type or undefined
    expectTypeOf(result.object).toExtend<{ items: string[]; count: number }>();
  });

  it('should infer OUTPUT type from structuredOutput schema (zod v4)', async () => {
    const customSchema = zv4.object({
      items: zv4.array(zv4.string()),
      count: zv4.number(),
    });

    const result = await agent.generate('List items', {
      structuredOutput: { schema: customSchema },
    });

    // object can be the output type or undefined
    expectTypeOf(result.object).toExtend<{ items: string[]; count: number }>();
  });

  it('should accept MessageListInput as messages parameter', async () => {
    // String
    const r1 = await agent.generate('Hello');
    expectTypeOf(r1).toExtend<FullOutput<any>>();

    // Array of messages
    const r2 = await agent.generate([{ role: 'user', content: 'Hello' }]);
    expectTypeOf(r2).toExtend<FullOutput<any>>();
  });
});

describe('stream', () => {
  it('should return MastraModelOutput<undefined> when called without structuredOutput', async () => {
    const result = await agent.stream('Hello');
    expectTypeOf(result).toEqualTypeOf<MastraModelOutput<undefined>>();
  });

  it('should return MastraModelOutput<OUTPUT> when structuredOutput is provided(zod-v3)', async () => {
    const result = await agent.stream('Hello', {
      structuredOutput: {
        schema: sentimentSchema,
      },
    });
    expectTypeOf(result).toEqualTypeOf<
      MastraModelOutput<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
    >();
  });

  it('should return MastraModelOutput<OUTPUT> when structuredOutput is provided (zod-v4)', async () => {
    const result = await agent.stream('Hello', {
      structuredOutput: {
        schema: sentimentSchemaV4,
      },
    });
    expectTypeOf(result).toEqualTypeOf<
      MastraModelOutput<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
    >();
  });

  it('should provide typed object from stream result', async () => {
    const result = await agent.stream('Analyze', {
      structuredOutput: { schema: sentimentSchema },
    });

    const output = await result.getFullOutput();
    // object can be the output type or undefined
    expectTypeOf(output.object).toExtend<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>();
  });

  it('should infer OUTPUT type from complex schema', async () => {
    const taskSchema = zv3.object({
      tasks: zv3.array(
        zv3.object({
          id: zv3.string(),
          title: zv3.string(),
          completed: zv3.boolean(),
          priority: zv3.enum(['low', 'medium', 'high']),
        }),
      ),
    });

    const result = await agent.stream('Create tasks', {
      structuredOutput: { schema: taskSchema },
    });

    expectTypeOf(result).toEqualTypeOf<
      MastraModelOutput<{
        tasks: Array<{
          id: string;
          title: string;
          completed: boolean;
          priority: 'low' | 'medium' | 'high';
        }>;
      }>
    >();
  });
});

describe('generateLegacy', () => {
  it('should return GenerateTextResult when called without output schema', async () => {
    const result = await agent.generateLegacy('Hello');
    expectTypeOf(result).toExtend<GenerateTextResult<any, undefined>>();
    expectTypeOf(result.text).toBeString();
  });

  it('should return GenerateObjectResult when output schema is provided', async () => {
    const result = await agent.generateLegacy('Analyze', {
      output: sentimentSchema,
    });
    expectTypeOf(result).toExtend<GenerateObjectResult<typeof sentimentSchema>>();
    expectTypeOf(result.object).toEqualTypeOf<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>();
  });

  it('should return GenerateTextResult with experimental_output', async () => {
    const result = await agent.generateLegacy('Analyze', {
      experimental_output: sentimentSchema,
    });
    expectTypeOf(result).toExtend<GenerateTextResult<any, typeof sentimentSchema>>();
  });

  it('should correctly type output with complex schema', async () => {
    const reviewSchema = zv3.object({
      rating: zv3.number().min(1).max(5),
      summary: zv3.string(),
      pros: zv3.array(zv3.string()),
      cons: zv3.array(zv3.string()),
    });

    const result = await agent.generateLegacy('Review product', {
      output: reviewSchema,
    });

    expectTypeOf(result.object).toEqualTypeOf<{
      rating: number;
      summary: string;
      pros: string[];
      cons: string[];
    }>();
  });
});

describe('streamLegacy', () => {
  it('should return StreamTextResult when called without output schema', async () => {
    const result = await agent.streamLegacy('Tell me a story');
    expectTypeOf(result).toExtend<StreamTextResult<any, undefined>>();
  });

  it('should return StreamObjectResult when output schema is provided', async () => {
    const result = await agent.streamLegacy('Analyze', {
      output: sentimentSchema,
    });
    // StreamObjectResult takes a single schema type parameter in Mastra
    expectTypeOf(result).toExtend<StreamObjectResult<typeof sentimentSchema>>();
  });

  it('should return StreamTextResult with partialObjectStream when experimental_output is provided', async () => {
    const result = await agent.streamLegacy('Analyze', {
      experimental_output: sentimentSchema,
    });
    expectTypeOf(result).toExtend<StreamTextResult<any, undefined>>();
    // Should have partialObjectStream property
    expectTypeOf(result).toHaveProperty('partialObjectStream');
  });

  it('should correctly type stream result with complex schema', async () => {
    const analysisSchema = zv3.object({
      categories: zv3.array(
        zv3.object({
          name: zv3.string(),
          score: zv3.number(),
        }),
      ),
      overallSentiment: zv3.enum(['positive', 'negative', 'neutral']),
    });

    const result = await agent.streamLegacy('Analyze text', {
      output: analysisSchema,
    });

    expectTypeOf(result).toExtend<StreamObjectResult<typeof analysisSchema>>();
  });
});

describe('network', () => {
  it('should return MastraAgentNetworkStream<undefined> when called without structuredOutput', async () => {
    const result = await agent.network('Hello');
    expectTypeOf(result).toEqualTypeOf<MastraAgentNetworkStream<undefined>>();
  });

  it('should return MastraAgentNetworkStream<OUTPUT> when structuredOutput is provided (zod v3)', async () => {
    const result = await agent.network('Analyze this task', {
      structuredOutput: {
        schema: sentimentSchema,
      },
    });
    expectTypeOf(result).toEqualTypeOf<
      MastraAgentNetworkStream<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
    >();
  });

  it('should return MastraAgentNetworkStream<OUTPUT> when structuredOutput is provided (zod v4)', async () => {
    const result = await agent.network('Analyze this task', {
      structuredOutput: {
        schema: sentimentSchemaV4,
      },
    });
    expectTypeOf(result).toEqualTypeOf<
      MastraAgentNetworkStream<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
    >();
  });

  it('should provide typed object promise from network result', async () => {
    const result = await agent.network('Analyze', {
      structuredOutput: { schema: sentimentSchema },
    });

    const obj = await result.object;
    expectTypeOf(obj).toExtend<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>();
  });

  it('should infer OUTPUT type from complex schema', async () => {
    const reportSchema = zv3.object({
      title: zv3.string(),
      sections: zv3.array(
        zv3.object({
          heading: zv3.string(),
          content: zv3.string(),
          importance: zv3.enum(['high', 'medium', 'low']),
        }),
      ),
      metadata: zv3.object({
        author: zv3.string(),
        createdAt: zv3.string(),
      }),
    });

    const result = await agent.network('Generate a report', {
      structuredOutput: { schema: reportSchema },
    });

    expectTypeOf(result).toEqualTypeOf<
      MastraAgentNetworkStream<{
        title: string;
        sections: Array<{
          heading: string;
          content: string;
          importance: 'high' | 'medium' | 'low';
        }>;
        metadata: {
          author: string;
          createdAt: string;
        };
      }>
    >();
  });

  it('should accept network options', async () => {
    const result = await agent.network('Do something', {
      maxSteps: 10,
      autoResumeSuspendedTools: true,
      runId: 'custom-run-id',
    });
    expectTypeOf(result).toEqualTypeOf<MastraAgentNetworkStream<undefined>>();
  });

  it('should extend ReadableStream for streaming', async () => {
    const result = await agent.network('Hello');
    // MastraAgentNetworkStream extends ReadableStream
    expectTypeOf(result).toExtend<ReadableStream>();
  });
});
