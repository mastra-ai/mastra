import { describe, it, expect } from 'vitest';
import { generateAgent } from '../utils.js';

describe('agent generate', () => {
  describe('simple text generation', () => {
    it('should generate a text response', async () => {
      const { status, data } = await generateAgent('test-agent', {
        messages: [{ role: 'user', content: 'What is 2+2? Reply with just the number.' }],
      });

      expect(status).toBe(200);
      expect(data.text).toContain('4');
      expect(data.finishReason).toBe('stop');
    });

    it('should include usage information', async () => {
      const { data } = await generateAgent('test-agent', {
        messages: [{ role: 'user', content: 'Say hello.' }],
      });

      expect(data.usage).toBeDefined();
      expect(data.usage.inputTokens).toBeGreaterThan(0);
      expect(data.usage.outputTokens).toBeGreaterThan(0);
    });
  });

  describe('tool use', () => {
    it('should call calculator tool and return correct result', async () => {
      const { status, data } = await generateAgent('test-agent', {
        messages: [{ role: 'user', content: 'Use the calculator tool to multiply 7 by 6. Do not do the math yourself.' }],
      });

      expect(status).toBe(200);
      expect(data.toolResults, 'LLM did not invoke any tools — expected calculator to be called').toBeDefined();
      expect(data.toolResults.length, 'LLM did not invoke any tools — expected calculator to be called').toBeGreaterThan(0);

      const calcResult = data.toolResults.find((r: any) => r.payload.toolName === 'calculator');
      expect(calcResult, 'LLM did not invoke the calculator tool').toBeDefined();
      expect(calcResult!.payload.result).toEqual({ result: 42 });
    });

    it('should call string-transform tool', async () => {
      const { status, data } = await generateAgent('test-agent', {
        messages: [
          {
            role: 'user',
            content: 'Use the string-transform tool to convert "hello world" to uppercase.',
          },
        ],
      });

      expect(status).toBe(200);
      expect(data.toolResults, 'LLM did not invoke any tools — expected string-transform to be called').toBeDefined();
      expect(data.toolResults.length, 'LLM did not invoke any tools — expected string-transform to be called').toBeGreaterThan(0);

      const strResult = data.toolResults.find((r: any) => r.payload.toolName === 'string-transform');
      expect(strResult, 'LLM did not invoke the string-transform tool').toBeDefined();
      expect(strResult!.payload.result).toEqual({ result: 'HELLO WORLD' });
    });
  });

  describe('multi-turn with memory', () => {
    it('should remember context across turns on the same thread', async () => {
      const threadId = crypto.randomUUID();
      const resourceId = 'smoke-test-user';

      // First turn: introduce a fact
      const { data: first } = await generateAgent('test-agent', {
        messages: [
          {
            role: 'user',
            content: 'Remember this: the secret code is ALPHA-7. Just confirm you got it.',
          },
        ],
        memory: { thread: threadId, resource: resourceId },
      });

      expect(first.text).toBeTruthy();

      // Second turn: ask about the fact on the same thread
      const { data: second } = await generateAgent('test-agent', {
        messages: [{ role: 'user', content: 'What is the secret code I told you?' }],
        memory: { thread: threadId, resource: resourceId },
      });

      expect(second.text).toBeTruthy();
      expect(second.text.toUpperCase()).toContain('ALPHA-7');
    });
  });

  describe('error handling', () => {
    it('should return 404 for non-existent agent', async () => {
      const { status } = await generateAgent('does-not-exist', {
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(status).toBe(404);
    });
  });
});
