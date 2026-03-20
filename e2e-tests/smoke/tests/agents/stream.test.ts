import { describe, it, expect } from 'vitest';
import { streamAgent } from '../utils.js';

describe('agent stream', () => {
  describe('simple text streaming', () => {
    it('should stream a text response with expected event sequence', async () => {
      const { status, events } = await streamAgent('test-agent', {
        messages: [{ role: 'user', content: 'Say "hello world" and nothing else.' }],
      });

      expect(status).toBe(200);
      expect(events.length).toBeGreaterThan(0);

      // Verify event sequence: start → step-start → text-start → text-delta(s) → text-end → step-finish → finish
      const types = events.map((e: any) => e.type);
      expect(types[0]).toBe('start');
      expect(types).toContain('text-delta');
      expect(types).toContain('step-finish');
      expect(types[types.length - 1]).toBe('finish');

      // Text deltas should contain the expected phrase
      const textDeltas = events.filter((e: any) => e.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThan(0);

      const fullText = textDeltas.map((e: any) => e.payload.text).join('');
      expect(fullText.toLowerCase()).toContain('hello world');

      // step-finish should contain usage info
      const stepFinish = events.find((e: any) => e.type === 'step-finish');
      expect(stepFinish, 'expected a step-finish event in the stream').toBeDefined();
      expect(stepFinish!.payload.output.usage.inputTokens).toBeGreaterThan(0);
      expect(stepFinish!.payload.output.usage.outputTokens).toBeGreaterThan(0);
    });
  });

  describe('stream with tool use', () => {
    it('should stream tool call and result events', async () => {
      const { status, events } = await streamAgent('test-agent', {
        messages: [
          {
            role: 'user',
            content: 'Use the calculator tool to add 10 and 32. Do not do the math yourself.',
          },
        ],
      });

      expect(status).toBe(200);

      const types = events.map((e: any) => e.type);
      expect(types[0]).toBe('start');
      expect(types[types.length - 1]).toBe('finish');

      // Should have tool-call and tool-result events
      expect(types, 'LLM did not invoke any tools — expected tool-call event').toContain('tool-call');
      expect(types, 'LLM did not return tool results — expected tool-result event').toContain('tool-result');

      const toolCall = events.find((e: any) => e.type === 'tool-call');
      expect(toolCall, 'expected a tool-call event for calculator').toBeDefined();
      expect(toolCall!.payload.toolName).toBe('calculator');

      const toolResult = events.find((e: any) => e.type === 'tool-result');
      expect(toolResult, 'expected a tool-result event for calculator').toBeDefined();
      expect(toolResult!.payload.toolName).toBe('calculator');
      expect(toolResult!.payload.result).toEqual({ result: 42 });
    });
  });

  describe('error handling', () => {
    it('should return error for non-existent agent', async () => {
      const { status } = await streamAgent('does-not-exist', {
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(status).toBe(404);
    });
  });
});
