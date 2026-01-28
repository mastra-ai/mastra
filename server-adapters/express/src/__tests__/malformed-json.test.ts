/**
 * Test suite for malformed JSON body handling
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/12310
 *
 * Verifies that express.json() middleware correctly returns 400 for malformed JSON.
 */
import http from 'node:http';
import express from 'express';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Malformed JSON Body Handling', () => {
  let app: Application;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Simple test endpoint
    app.post('/test', (req, res) => {
      res.json({ received: req.body });
    });

    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address() as { port: number };
    baseUrl = `http://localhost:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  describe('express.json() middleware behavior', () => {
    it('should return 400 for malformed JSON', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid": "json"', // Missing closing brace
      });

      expect(response.status).toBe(400);
    });

    it('should return 200 for valid JSON', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"valid": "json"}',
      });

      expect(response.status).toBe(200);
    });

    it('should handle empty body gracefully', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      // Express returns 400 for empty body with application/json
      expect(response.status).toBeLessThan(500);
    });
  });
});
