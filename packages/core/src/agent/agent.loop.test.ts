import { openai } from '@ai-sdk/openai-v5';
import { MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { RuntimeContext } from '../runtime-context';
import { Agent } from './index';

vi.setConfig({
  testTimeout: 30_000,
});

describe('Agent Loop Tests', () => {
  it('Should throw an error if the model is a v2 model', async () => {
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: new MockLanguageModelV2({
        modelId: 'test',
      }),
    });

    await expect(agent.generate('test')).rejects.toThrow(
      'V2 models are not supported for generate. Please use generate_vnext instead.',
    );
  });

  it('Should generate a response using a v2 model', async () => {
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: openai('gpt-4o-mini'),
    });

    let result = await agent.generate_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'aisdk',
    });

    console.log(result);

    result = await agent.generate_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'mastra',
    });

    console.log(result);
  });

  it('Should stream a response using a v2 model', async () => {
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: openai('gpt-4o-mini'),
    });

    let result = await agent.stream_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'aisdk',
    });

    console.log(result);

    if (result) {
      for await (const chunk of result.fullStream) {
        console.log(chunk);
      }

      console.log(result.text);
    }

    result = await agent.stream_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'mastra',
    });

    if (result) {
      for await (const chunk of result.fullStream) {
        console.log(chunk);
      }
      console.log(result.text);
    }
  });

  it('should pass an array of messages to the model', async () => {
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: openai('gpt-4o-mini'),
    });

    let result = await agent.generate_vnext(
      [
        {
          role: 'user',
          content: 'test',
        },
      ],
      {
        runtimeContext: new RuntimeContext(),
        format: 'aisdk',
      },
    );

    console.log(result?.text);

    result = await agent.generate_vnext(
      [
        {
          role: 'user',
          content: 'test',
        },
      ],
      {
        runtimeContext: new RuntimeContext(),
        format: 'mastra',
      },
    );

    console.log(result?.text);
  });

  it('should generate an object when output is passed', async () => {
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: openai('gpt-4o-mini'),
    });

    const result = await agent.generate_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'aisdk',
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    console.log(result.object);
  });

  it('should stream an object when output is passed', async () => {
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'You are a helpful assistant that provides structured data.',
      model: openai('gpt-4o-mini'),
    });

    // Test with aisdk format
    let result = await agent.stream_vnext('Generate a person with name "John Doe" and age 30', {
      runtimeContext: new RuntimeContext(),
      format: 'aisdk',
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const aisdkChunks = [];
    for await (const chunk of result.objectStream) {
      aisdkChunks.push(chunk);
    }

    const aisdkObject = await result.object;
    expect(aisdkObject).toBeDefined();
    expect(aisdkObject.name).toBe('John Doe');
    expect(aisdkObject.age).toBe(30);

    // Test with mastra format
    result = await agent.stream_vnext('Generate a person with name "Jane Smith" and age 25', {
      runtimeContext: new RuntimeContext(),
      format: 'mastra',
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const mastraChunks = [];
    for await (const chunk of result.objectStream) {
      mastraChunks.push(chunk);
    }

    const mastraObject = await result.object;
    expect(mastraObject).toBeDefined();
    expect(mastraObject.name).toBe('Jane Smith');
    expect(mastraObject.age).toBe(25);
  });
});
