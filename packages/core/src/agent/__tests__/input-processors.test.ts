import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../memory';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';

// Legacy (AI SDK v4) generateLegacy/streamLegacy path only. That path does not run through
// loop(), so the aimock loop scenarios cannot cover it; the current path lives in
// loop/test-utils/aimock/scenarios/input-processor-pipeline.scenario.test.ts.
// MockLanguageModelV1 is used because aimock drives v5 providers, not the v4 legacy model path.
describe('v1 - Input Processors (legacy)', () => {
  const createMessage = (text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage => ({
    id: crypto.randomUUID(),
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  });

  const promptText = (prompt: unknown) =>
    (Array.isArray(prompt) ? prompt : [])
      .map(msg => {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
          return msg.content
            .filter((part: { type: string }) => part.type === 'text')
            .map((part: { text: string }) => part.text)
            .join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');

  // Echoes the prompt it receives so each case can assert what the processors sent.
  const mockModel = () =>
    new MockLanguageModelV1({
      doGenerate: async ({ prompt }) => ({
        text: `processed: ${promptText(prompt)}`,
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: prompt, rawSettings: {} },
      }),
      doStream: async ({ prompt }) => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'processed: ' },
            { type: 'text-delta', textDelta: promptText(prompt) },
            { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 20 } },
          ],
        }),
        rawCall: { rawPrompt: prompt, rawSettings: {} },
      }),
    });

  const agentWith = (inputProcessors: any) =>
    new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant',
      model: mockModel(),
      inputProcessors,
    });

  const appendNote = (id: string, text: string) => ({
    id,
    processInput: async ({ messages }: { messages: MastraDBMessage[] }) => {
      messages.push(createMessage(text));
      return messages;
    },
  });

  const abortWith = (id: string, reason?: string) => ({
    id,
    processInput: async ({ abort, messages }: { abort: (reason?: string) => never; messages: MastraDBMessage[] }) => {
      abort(reason);
      return messages;
    },
  });

  describe('basic functionality', () => {
    it('should run input processors before generation', async () => {
      const result = await agentWith([appendNote('test-processor', 'Processor was here!')]).generateLegacy(
        'Hello world',
      );

      expect(result.text).toContain('processed:');
      expect(result.text).toContain('Processor was here!');
    });

    it('should run multiple processors in order', async () => {
      const result = await agentWith([
        appendNote('processor-1', 'First processor'),
        appendNote('processor-2', 'Second processor'),
      ]).generateLegacy('Hello');

      expect(result.text).toContain('Hello First processor Second processor');
    });

    it('should support async processors running in sequence', async () => {
      const second = {
        id: 'async-processor-2',
        processInput: async ({ messages }: { messages: MastraDBMessage[] }) => {
          await Promise.resolve();
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };
      const result = await agentWith([appendNote('async-processor-1', 'First processor'), second]).generateLegacy(
        'Test async',
      );

      expect(result.text).toContain('Test async First processor Second processor');
    });
  });

  describe('tripwire functionality', () => {
    it('should handle processor abort with default message', async () => {
      const result = await agentWith([abortWith('abort-processor')]).generateLegacy('This should be aborted');

      expect(result.text).toBe('');
      expect(result.finishReason).toBe('other');
      expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-processor');
    });

    it('should handle processor abort with custom message', async () => {
      const result = await agentWith([abortWith('custom-abort', 'Custom abort reason')]).generateLegacy(
        'Custom abort test',
      );

      expect(result.text).toBe('');
      expect(result.tripwire?.reason).toBe('Custom abort reason');
    });

    it('should not execute subsequent processors after abort', async () => {
      let secondProcessorExecuted = false;
      const shouldNotRun = {
        id: 'should-not-run',
        processInput: async ({ messages }: { messages: MastraDBMessage[] }) => {
          secondProcessorExecuted = true;
          return messages;
        },
      };

      const result = await agentWith([abortWith('abort-first', 'Stop here'), shouldNotRun]).generateLegacy(
        'Abort sequence test',
      );

      expect(secondProcessorExecuted).toBe(false);
      expect(result.tripwire?.reason).toBe('Stop here');
    });
  });

  describe('streaming with input processors', () => {
    it('should handle input processors with streaming', async () => {
      const stream = await agentWith([appendNote('stream-processor', 'Stream processor active')]).streamLegacy(
        'Stream test',
      );

      let fullText = '';
      for await (const textPart of stream.textStream) {
        fullText += textPart;
      }

      expect(fullText).toContain('Stream processor active');
    });

    it('should handle abort in streaming with tripwire response', async () => {
      const stream = await agentWith([abortWith('stream-abort', 'Stream aborted')]).streamLegacy('Stream abort test');

      let textReceived = '';
      for await (const textPart of stream.textStream) {
        textReceived += textPart;
      }
      expect(textReceived).toBe('');
      expect(stream.tripwire?.reason).toBe('Stream aborted');
    });

    it('should include deployer methods when tripwire is triggered in streaming', async () => {
      const stream = await agentWith([abortWith('deployer-abort', 'Deployer test abort')]).streamLegacy(
        'Deployer abort test',
      );

      expect(stream.tripwire?.reason).toBe('Deployer test abort');
      const dataStreamResponse = stream.toDataStreamResponse();
      const textStreamResponse = stream.toTextStreamResponse();
      expect(dataStreamResponse).toBeInstanceOf(Response);
      expect(textStreamResponse).toBeInstanceOf(Response);
      expect(dataStreamResponse.status).toBe(200);
      expect(textStreamResponse.status).toBe(200);
      expect(typeof stream.pipeDataStreamToResponse).toBe('function');
      expect(typeof stream.pipeTextStreamToResponse).toBe('function');
      expect(typeof stream.experimental_partialOutputStream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('dynamic input processors', () => {
    it('should support function-based input processors', async () => {
      const requestContext = new RequestContext();
      requestContext.set('processorMessage', 'Dynamic message');

      const agent = agentWith(({ requestContext }: { requestContext: RequestContext }) => [
        appendNote('dynamic-processor', (requestContext.get('processorMessage') as string) || 'Default message'),
      ]);
      const result = await agent.generateLegacy('Test dynamic', { requestContext });

      expect(result.text).toContain('Dynamic message');
    });

    it('should handle empty processors array', async () => {
      const result = await agentWith([]).generateLegacy('No processors test');

      expect(result.text).toBe('processed: You are a helpful assistant No processors test');
    });
  });

  describe('message manipulation', () => {
    it('should allow processors to modify message content', async () => {
      const result = await agentWith([
        appendNote('message-modifier', 'MODIFIED: Original message was received'),
      ]).generateLegacy('Original user message');

      expect(result.text).toContain('Original user message MODIFIED: Original message was received');
    });

    it('should allow processors to filter or validate messages', async () => {
      const validator = {
        id: 'validator',
        processInput: async ({
          messages,
          abort,
        }: {
          messages: MastraDBMessage[];
          abort: (reason?: string) => never;
        }) => {
          const text = messages
            .map(msg => msg.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join(' '))
            .join(' ');
          if (text.includes('inappropriate')) {
            abort('Content validation failed');
          } else {
            messages.push(createMessage('Content validated'));
          }
          return messages;
        },
      };
      const agent = agentWith([validator]);

      const validResult = await agent.generateLegacy('This is appropriate content');
      expect(validResult.text).toContain('Content validated');

      const invalidResult = await agent.generateLegacy('This contains inappropriate content');
      expect(invalidResult.tripwire?.reason).toBe('Content validation failed');
    });
  });
});
