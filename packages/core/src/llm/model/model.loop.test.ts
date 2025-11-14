import { openai } from '@ai-sdk/openai-v5';
import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import { RequestContext } from '../../request-context';
import { MastraLLMVNext } from './model.loop';

const model = new MastraLLMVNext({
  models: [{ model: openai('gpt-4o-mini'), maxRetries: 0, id: 'test-model' }],
});

describe.concurrent('MastraLLMVNext', () => {
  it('should generate text - mastra', async () => {
    const result = model.stream({
      requestContext: new RequestContext(),
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        'input',
      ),
      tracingContext: {},
      agentId: 'test-agent',
    });

    const res = await result.getFullOutput();
    expect(res).toBeDefined();
    expect(res.text).toBeDefined();
    expect(res.text).toBeTypeOf('string');
  }, 20000);

  it('should generate text - aisdk', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      agentId: 'test-agent',
    });

    const res = await result.aisdk.v5.getFullOutput();
    expect(res).toBeDefined();
    expect(res.text).toBeDefined();
    expect(res.text).toBeTypeOf('string');
  }, 20000);

  it('should stream text - mastra', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      agentId: 'test-agent',
    });

    const chunks = await convertAsyncIterableToArray(result.fullStream);
    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
  }, 20000);

  it('should stream text - aisdk', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      agentId: 'test-agent',
    });

    const chunks = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);
    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
  }, 20000);

  it('should stream object - mastra/aisdk', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you? My name is John Doe and I am 30 years old.',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
      },
      agentId: 'test-agent',
    });

    const objectStreamChunks = await convertAsyncIterableToArray(result.objectStream);
    expect(objectStreamChunks).toBeDefined();
    expect(objectStreamChunks.length).toBeGreaterThan(0);
    objectStreamChunks.forEach(chunk => {
      expect(chunk).toBeTypeOf('object');
    });

    const lastChunk = objectStreamChunks[objectStreamChunks.length - 1];
    expect(lastChunk).toBeDefined();
    expect(lastChunk.name).toBeDefined();
    expect(lastChunk.name).toBeTypeOf('string');
    expect(lastChunk.age).toBeDefined();
    expect(lastChunk.age).toBeTypeOf('number');

    const object = await result.object;
    expect(object).toBeDefined();
    expect(object.name).toBeDefined();
    expect(object.name).toBeTypeOf('string');
    expect(object.age).toBeDefined();
    expect(object.age).toBeTypeOf('number');

    const aisdkObjectStreamChunks = await convertAsyncIterableToArray(result.aisdk.v5.objectStream);
    expect(aisdkObjectStreamChunks).toBeDefined();
    expect(aisdkObjectStreamChunks.length).toBeGreaterThan(0);
    aisdkObjectStreamChunks.forEach(chunk => {
      expect(chunk).toBeTypeOf('object');
    });

    const aisdkLastChunk = aisdkObjectStreamChunks[aisdkObjectStreamChunks.length - 1];
    expect(aisdkLastChunk).toBeDefined();
    expect(aisdkLastChunk.name).toBeDefined();
    expect(aisdkLastChunk.name).toBeTypeOf('string');
    expect(aisdkLastChunk.age).toBeDefined();
    expect(aisdkLastChunk.age).toBeTypeOf('number');

    const aisdkObject = await result.aisdk.v5.object;
    expect(aisdkObject).toBeDefined();
    expect(aisdkObject.name).toBeDefined();
    expect(aisdkObject.name).toBeTypeOf('string');
    expect(aisdkObject.age).toBeDefined();
    expect(aisdkObject.age).toBeTypeOf('number');
  }, 20000);

  it('should generate object - mastra', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you? My name is John Doe and I am 30 years old.',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
      },
      agentId: 'test-agent',
    });

    const res = await result.getFullOutput();

    expect(res.object).toBeDefined();
    expect(res.object.name).toBeDefined();
    expect(res.object.name).toBeTypeOf('string');
    expect(res.object.age).toBeDefined();
    expect(res.object.age).toBeTypeOf('number');
  }, 20000);

  it('should generate object - aisdk', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you? My name is John Doe and I am 30 years old.',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
      },
      agentId: 'test-agent',
    });

    const res = await result.aisdk.v5.getFullOutput();

    expect(res.object).toBeDefined();
    expect(res.object?.name).toBeDefined();
    expect(res.object?.name).toBeTypeOf('string');
    expect(res.object?.age).toBeDefined();
    expect(res.object?.age).toBeTypeOf('number');
  }, 20000);

  it('full stream object - mastra', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you? My name is John Doe and I am 30 years old.',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
      },
      agentId: 'test-agent',
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'object') {
        expect(chunk.object).toBeDefined();
      }
    }

    const object = await result.object;
    expect(object).toBeDefined();
    expect(object.name).toBeDefined();
    expect(object.name).toBeTypeOf('string');
    expect(object.age).toBeDefined();
    expect(object.age).toBeTypeOf('number');
  }, 20000);

  it('full stream object - aisdk', async () => {
    const result = model.stream({
      messageList: new MessageList().add(
        [
          {
            role: 'user',
            content: 'Hello, how are you? My name is John Doe and I am 30 years old.',
          },
        ],
        'input',
      ),
      requestContext: new RequestContext(),
      tracingContext: {},
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
      },
      agentId: 'test-agent',
    });

    for await (const chunk of result.aisdk.v5.fullStream) {
      if (chunk.type === 'object') {
        expect(chunk.object).toBeDefined();
      }
    }

    const object = await result.aisdk.v5.object;
    expect(object).toBeDefined();
    expect(object.name).toBeDefined();
    expect(object.name).toBeTypeOf('string');
    expect(object.age).toBeDefined();
    expect(object.age).toBeTypeOf('number');
  }, 20000);
});
