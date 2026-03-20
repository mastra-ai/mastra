import { describe, it, expect } from 'vitest';
import { generateAgent, streamAgent } from '../utils.js';

describe('agent structured output', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      capital: { type: 'string' },
      population: { type: 'number' },
    },
    required: ['name', 'capital', 'population'],
    additionalProperties: false,
  };

  describe('generate with structuredOutput', () => {
    it('should return structured JSON matching the schema', async () => {
      const { status, data } = await generateAgent('test-agent', {
        messages: [{ role: 'user', content: 'Give me info about France.' }],
        structuredOutput: { schema },
      });

      expect(status).toBe(200);

      // generate with structuredOutput returns the parsed object at data.object
      expect(data.object, 'LLM did not return structured output — expected object with name/capital/population').toBeDefined();
      expect(typeof data.object.name).toBe('string');
      expect(typeof data.object.capital).toBe('string');
      expect(typeof data.object.population).toBe('number');
      expect(data.object.name.toLowerCase()).toContain('france');
    });
  });

  describe('stream with structuredOutput', () => {
    it('should stream text deltas that form valid structured JSON', async () => {
      const { status, events } = await streamAgent('test-agent', {
        messages: [{ role: 'user', content: 'Give me info about Japan.' }],
        structuredOutput: { schema },
      });

      expect(status).toBe(200);
      expect(events.length).toBeGreaterThan(0);

      const types = events.map((e: any) => e.type);
      expect(types[0]).toBe('start');
      expect(types[types.length - 1]).toBe('finish');
      expect(types).toContain('text-delta');

      // Collect all text deltas and parse as JSON
      const textDeltas = events.filter((e: any) => e.type === 'text-delta');
      const fullText = textDeltas.map((e: any) => e.payload.text).join('');

      let parsed: any;
      try {
        parsed = JSON.parse(fullText);
      } catch {
        throw new Error(`Stream text deltas did not form valid JSON: ${fullText.slice(0, 200)}`);
      }

      expect(typeof parsed.name).toBe('string');
      expect(typeof parsed.capital).toBe('string');
      expect(typeof parsed.population).toBe('number');
      expect(parsed.name.toLowerCase()).toContain('japan');
    });
  });
});
