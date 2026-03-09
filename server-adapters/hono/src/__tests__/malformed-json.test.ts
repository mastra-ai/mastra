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
import { Hono } from 'hono';
import { describe, it, expect, beforeEach } from 'vitest';
import { MastraServer } from '../index';

describe('Malformed JSON Body Handling', () => {
  let context: AdapterTestContext;
  let app: Hono;

  beforeEach(async () => {
    context = await createDefaultTestContext();

    app = new Hono();

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
      const createRunResponse = await app.request(
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
      // The malformed JSON: {"inputData":{"city":"NYC"}
      // Note: Missing closing brace at the end
      const malformedResponse = await app.request(
        new Request('http://localhost/api/workflows/test-workflow/start?runId=test-malformed-json-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"inputData":{"city":"NYC"}', // Missing closing }
        }),
      );

      // The server should return 400 Bad Request for malformed JSON
      // NOT 200 with workflow started, and NOT hang/timeout
      expect(malformedResponse.status).toBe(400);

      const errorResult = await malformedResponse.json();
      expect(errorResult.error).toBeDefined();
    });

    it('should continue responding to requests after receiving malformed JSON', async () => {
      // Send malformed JSON to an endpoint
      const malformedResponse = await app.request(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid json here',
        }),
      );

      // We expect this to return a 400
      expect(malformedResponse.status).toBe(400);

      // The server should still respond to subsequent valid requests
      const validResponse = await app.request(
        new Request('http://localhost/api/agents', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Server should be responsive and return 200
      expect(validResponse.status).toBe(200);
    });

    it('should return structured error response for malformed JSON', async () => {
      const malformedResponse = await app.request(
        new Request('http://localhost/api/workflows/test-workflow/start-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"inputData": [1, 2, 3', // Missing closing bracket and brace
        }),
      );

      expect(malformedResponse.status).toBe(400);

      const errorResult = await malformedResponse.json();

      // Should have a helpful error message
      expect(errorResult).toBeDefined();
      expect(errorResult.error || errorResult.message || errorResult.issues).toBeDefined();
    });

    it('should handle empty string body gracefully', async () => {
      const emptyBodyResponse = await app.request(
        new Request('http://localhost/api/workflows/test-workflow/start-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '', // Empty body
        }),
      );

      // Empty body with application/json header should be allowed
      // The handler will receive an empty object and may succeed or fail based on validation
      // The key is that the server should NOT crash
      expect(emptyBodyResponse.status).toBeLessThan(500);
    });

    it('should handle truncated JSON gracefully', async () => {
      const truncatedResponse = await app.request(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"messages": [{"role": "user", "content": "hel', // Truncated mid-string
        }),
      );

      // Should return 400, not crash or hang
      expect(truncatedResponse.status).toBe(400);
    });

    it('should handle JSON with trailing garbage gracefully', async () => {
      const trailingGarbageResponse = await app.request(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"messages": []}garbage', // Valid JSON followed by garbage
        }),
      );

      // Should return 400 because the body is not valid JSON
      expect(trailingGarbageResponse.status).toBe(400);
    });

    it('should not process workflow with missing inputData when JSON parsing fails', async () => {
      // This test verifies the underlying issue: when JSON parsing fails,
      // the workflow should not be started with undefined/empty data.
      // The original issue shows the workflow gets started despite malformed JSON.

      // First, create a workflow run
      const createRunResponse = await app.request(
        new Request('http://localhost/api/workflows/test-workflow/create-run?runId=test-inputdata-validation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(createRunResponse.status).toBe(200);

      // Send malformed JSON - this should NOT start the workflow
      const malformedStartResponse = await app.request(
        new Request('http://localhost/api/workflows/test-workflow/start?runId=test-inputdata-validation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"inputData": {"city": "NYC"', // Malformed: missing closing braces
        }),
      );

      // The expected behavior: return 400 Bad Request
      // The actual (buggy) behavior: returns 200 and starts workflow with undefined inputData
      expect(malformedStartResponse.status).toBe(400);

      // If we got 200, the workflow was started with undefined inputData - this is the bug
      if (malformedStartResponse.status === 200) {
        const result = await malformedStartResponse.json();
        // This demonstrates the bug: server says "Workflow run started"
        // but it was started with undefined/empty inputData
        expect(result.message).not.toBe('Workflow run started');
      }
    });
  });
});
