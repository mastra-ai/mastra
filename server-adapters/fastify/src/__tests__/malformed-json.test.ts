/**
 * Test suite for malformed JSON body handling
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/12310
 *
 * Verifies that Fastify's built-in JSON parser correctly returns 400 for malformed JSON.
 */
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Malformed JSON Body Handling', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();

    // Simple test endpoint
    app.post('/test', async request => {
      return { received: request.body };
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Fastify built-in JSON parser behavior', () => {
    it('should return 400 for malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'Content-Type': 'application/json' },
        payload: '{"invalid": "json"', // Missing closing brace
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 200 for valid JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'Content-Type': 'application/json' },
        payload: '{"valid": "json"}',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle empty body gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'Content-Type': 'application/json' },
        payload: '',
      });

      // Fastify returns 400 for empty body with application/json
      expect(response.statusCode).toBeLessThan(500);
    });
  });
});
