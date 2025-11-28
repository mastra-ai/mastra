import { describe, it, expect, vi } from 'vitest';
import { z as zV3 } from 'zod/v3';
import { zodToJsonSchema } from './zod-to-json';
import { runZodToJsonTestSuite } from './zod-to-json-test-suite';

// Mock 'zod' to use v3
vi.mock('zod', () => ({
  z: zV3,
}));

// Run the shared test suite with Zod v3
runZodToJsonTestSuite();

// Zod v3 specific tests for passthrough schema normalization
describe('zodToJsonSchema - Zod v3 specific', () => {
  describe('passthrough schema normalization', () => {
    it('should normalize additionalProperties: true to { type: "any" } for validator compatibility', () => {
      // Zod v3 produces additionalProperties: true (boolean) for passthrough
      const passthroughSchema = zV3
        .object({
          queryText: zV3.string(),
          topK: zV3.number(),
        })
        .passthrough();

      const result = zodToJsonSchema(passthroughSchema as any);

      // Should have additionalProperties normalized to { type: 'any' }
      expect(result.additionalProperties).toBeDefined();
      expect(result.additionalProperties).not.toBe(true);
      expect(result.additionalProperties).not.toBe(false);
      expect(typeof result.additionalProperties).toBe('object');
      expect((result.additionalProperties as any).type).toBe('any');
    });
  });
});
