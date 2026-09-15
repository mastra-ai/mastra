/**
 * Test suite for malformed JSON body handling
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/12310
 *
 * When a malformed JSON body is sent to a POST endpoint:
 * 1. The server should return a 400 Bad Request error
 * 2. The server should NOT become unresponsive
 * 3. Subsequent requests should continue to work normally
 */
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { Elysia } from 'elysia';
import { describe, it, expect, beforeEach } from 'vitest';
import { MastraServer } from '../index';

describe('Malformed JSON Body Handling', () => {
  let context: AdapterTestContext;
  let app: Elysia;

  beforeEach(async () => {
    context = await createDefaultTestContext();

    app = new Elysia();

    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
    });

    await adapter.init();
  });

  describe('Issue #12310: Server stops responding after malformed JSON', () => {
    it('should return 400 Bad Request when POST body contains malformed JSON', async () => {
      // First, create a workflow run
      const createRunResponse = await app.fetch(
        new Request('http://localhost/api/workflows/test-workflow/create-run?runId=test-malformed-json-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(createRunResponse.status).toBe(200);
      const createRunResult = await createRunResponse.json();
      expect(createRunResult.runId).toBe('test-malformed-json-run');

      // Now send malformed JSON (missing closing brace) - this is the exact issue from #12310
      const malformedResponse = await app.fetch(
        new Request('http://localhost/api/workflows/test-workflow/start?runId=test-malformed-json-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"inputData":{"city":"NYC"}', // Missing closing }
        }),
      );

      expect(malformedResponse.status).toBe(400);

      const errorResult = await malformedResponse.json();
      expect(errorResult.error).toBeDefined();
    });

    it('should continue responding to requests after receiving malformed JSON', async () => {
      const malformedResponse = await app.fetch(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid json here',
        }),
      );

      expect(malformedResponse.status).toBe(400);

      const validResponse = await app.fetch(
        new Request('http://localhost/api/agents', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(validResponse.status).toBe(200);
    });

    it('should return structured error response for malformed JSON', async () => {
      const malformedResponse = await app.fetch(
        new Request('http://localhost/api/workflows/test-workflow/start-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"inputData": [1, 2, 3', // Missing closing bracket and brace
        }),
      );

      expect(malformedResponse.status).toBe(400);

      const errorResult = await malformedResponse.json();

      expect(errorResult).toBeDefined();
      expect(errorResult.error || errorResult.message || errorResult.issues).toBeDefined();
    });

    it('should handle empty string body gracefully', async () => {
      const emptyBodyResponse = await app.fetch(
        new Request('http://localhost/api/workflows/test-workflow/start-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '',
        }),
      );

      expect(emptyBodyResponse.status).toBeLessThan(500);
    });

    it('should handle truncated JSON gracefully', async () => {
      const truncatedResponse = await app.fetch(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"messages": [{"role": "user", "content": "hel',
        }),
      );

      expect(truncatedResponse.status).toBe(400);
    });

    it('should handle JSON with trailing garbage gracefully', async () => {
      const trailingGarbageResponse = await app.fetch(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"messages": []}garbage',
        }),
      );

      expect(trailingGarbageResponse.status).toBe(400);
    });

    it('should not process workflow with missing inputData when JSON parsing fails', async () => {
      const createRunResponse = await app.fetch(
        new Request('http://localhost/api/workflows/test-workflow/create-run?runId=test-inputdata-validation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(createRunResponse.status).toBe(200);

      const malformedStartResponse = await app.fetch(
        new Request('http://localhost/api/workflows/test-workflow/start?runId=test-inputdata-validation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"inputData": {"city": "NYC"',
        }),
      );

      expect(malformedStartResponse.status).toBe(400);

      if (malformedStartResponse.status === 200) {
        const result = await malformedStartResponse.json();
        expect(result.message).not.toBe('Workflow run started');
      }
    });
  });
});
