import { openai } from '@ai-sdk/openai-v5';
import { MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import { RuntimeContext } from '../runtime-context';
import { Agent } from './index';

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
      instructions: 'test',
      model: openai('gpt-4o-mini'),
    });

    // @TODO: Weird chunks depending on run with gpt-4o-mini
    let result = await agent.stream_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'aisdk',
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    for await (const chunk of result.objectStream) {
      console.log('AISDK', chunk);
    }

    console.log(await result.object);

    result = await agent.stream_vnext('test', {
      runtimeContext: new RuntimeContext(),
      format: 'mastra',
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    for await (const chunk of result.objectStream) {
      console.log('MASTRA', chunk);
    }

    console.log(await result.object);
  });
});
