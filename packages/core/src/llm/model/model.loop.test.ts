import { openai } from '@ai-sdk/openai-v5';
import { describe, it } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import { RuntimeContext } from '../../runtime-context';
import { MastraLLMVNext } from './model.loop';

const model = new MastraLLMVNext({
  models: [{ model: openai('gpt-4o-mini'), maxRetries: 0, id: 'test-model' }],
});

describe('MastraLLMVNext', () => {
  it('should generate text - mastra', async () => {
    const result = model.stream({
      runtimeContext: new RuntimeContext(),
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
    });

    console.log(await result.getFullOutput());
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    console.log(await result.aisdk.v5.getFullOutput());
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    for await (const chunk of result.fullStream) {
      console.log(chunk.type);
      if ('payload' in chunk) {
        console.log(chunk.payload);
      }
    }
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    for await (const chunk of result.aisdk.v5.fullStream) {
      console.log(chunk.type);
    }
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    for await (const chunk of result.objectStream) {
      console.log(chunk);
    }

    console.log(await result.object);
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const res = await result.getFullOutput();

    console.log(res.object);
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const res = await result.aisdk.v5.getFullOutput();

    console.log(res.object);
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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'object') {
        console.log(chunk);
      }
    }

    console.log(await result.object);
  }, 10000);

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
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
      output: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    for await (const chunk of result.aisdk.v5.fullStream) {
      if (chunk.type === 'object') {
        console.log(chunk);
      }
      console.log(chunk);
    }

    console.log(await result.aisdk.v5.object);
  });
});
