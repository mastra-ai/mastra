/**
 * Integration tests for OtelBridge with multiple frameworks
 *
 * Tests the complete flow of OTEL context extraction from HTTP headers
 * by starting actual example servers and making requests to them.
 * This ensures both the OtelBridge works correctly across frameworks
 * and that the examples stay up-to-date.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from examples/.env if not already set
config({ path: resolve(__dirname, '../examples/.env') });

// Define framework configurations
const frameworks = [
  {
    name: 'Express',
    port: 3456,
    path: 'express-basic',
    routePrefix: '',
    serverFile: 'server.ts',
    startupMessage: 'Server running',
  },
  {
    name: 'Fastify',
    port: 3457,
    path: 'fastify-basic',
    routePrefix: '',
    serverFile: 'server.ts',
    startupMessage: 'Server running',
  },
  {
    name: 'Hono',
    port: 3458,
    path: 'hono-basic',
    routePrefix: '',
    serverFile: 'server.ts',
    startupMessage: 'Server running',
  },
  {
    name: 'Next.js',
    port: 3459,
    path: 'nextjs-basic',
    routePrefix: '/api',
    serverFile: null,
    startupMessage: 'Ready in',
  },
] as const;

// Shared test suite for all frameworks
function runFrameworkTests(framework: (typeof frameworks)[number]) {
  describe(`${framework.name} Integration Tests`, () => {
    let serverProcess: ChildProcess;
    const testPort = framework.port;

    beforeAll(async () => {
      // Skip tests if no OpenAI API key is provided
      if (!process.env.OPENAI_API_KEY) {
        console.log(`Skipping ${framework.name} integration tests: OPENAI_API_KEY not set`);
        return;
      }

      const exampleDir = resolve(__dirname, `../examples/${framework.path}`);

      // Start the example server
      // For Next.js, use pnpm dev. For others, use tsx to run server.ts
      if (framework.serverFile) {
        const examplePath = resolve(exampleDir, framework.serverFile);
        serverProcess = spawn('npx', ['tsx', examplePath], {
          env: { ...process.env },
          cwd: exampleDir,
        });
      } else {
        // Next.js - use pnpm dev
        serverProcess = spawn('pnpm', ['dev'], {
          env: { ...process.env },
          cwd: exampleDir,
          shell: true,
        });
      }

      // Wait for server to start
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`${framework.name} server failed to start within 30 seconds`));
        }, 30000); // Increased timeout for Next.js build

        serverProcess.stdout?.on('data', data => {
          const output = data.toString();
          if (output.includes(framework.startupMessage)) {
            clearTimeout(timeout);
            resolve();
          }
        });

        serverProcess.stderr?.on('data', data => {
          const output = data.toString();
          // Next.js outputs to stderr, check there too
          if (output.includes(framework.startupMessage)) {
            clearTimeout(timeout);
            resolve();
          }
          // Don't log all stderr for Next.js as it's verbose
          if (!output.includes('Ready in')) {
            console.error(`${framework.name} server stderr:`, output);
          }
        });

        serverProcess.on('error', err => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    afterAll(async () => {
      // Stop the server
      if (serverProcess) {
        serverProcess.kill();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    it('should respond to health check', { skip: !process.env.OPENAI_API_KEY }, async () => {
      const response = await fetch(`http://localhost:${testPort}${framework.routePrefix}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: 'ok' });
    });

    it(
      'should handle chat request without OTEL trace context',
      { skip: !process.env.OPENAI_API_KEY, timeout: 30000 },
      async () => {
        const response = await fetch(`http://localhost:${testPort}${framework.routePrefix}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: 'Say hello in 5 words or less' }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('response');
        expect(typeof data.response).toBe('string');
        expect(data.response.length).toBeGreaterThan(0);
        expect(data.otelContext.extracted).toBe(false);
        expect(data.otelContext.message).toBe('No OTEL trace context found in request headers');
      },
    );

    it(
      'should extract OTEL trace context from traceparent header',
      { skip: !process.env.OPENAI_API_KEY, timeout: 30000 },
      async () => {
        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

        const response = await fetch(`http://localhost:${testPort}${framework.routePrefix}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            traceparent,
          },
          body: JSON.stringify({ message: 'Say hi in 3 words' }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('response');
        expect(typeof data.response).toBe('string');
        expect(data.response.length).toBeGreaterThan(0);
        expect(data.otelContext.extracted).toBe(true);
        expect(data.otelContext.message).toBe('OTEL trace context was successfully extracted from headers');

        // Verify traceparent was extracted
        expect(data.otelContext.headers).toBeDefined();
        expect(data.otelContext.headers.traceparent).toBe(traceparent);
        expect(data.otelContext.headers.tracestate).toBeUndefined();
      },
    );

    it(
      'should extract OTEL trace context with tracestate header',
      { skip: !process.env.OPENAI_API_KEY, timeout: 30000 },
      async () => {
        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
        const tracestate = 'vendorname1=opaqueValue1,vendorname2=opaqueValue2';

        const response = await fetch(`http://localhost:${testPort}${framework.routePrefix}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            traceparent,
            tracestate,
          },
          body: JSON.stringify({ message: 'Count to 3' }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('response');
        expect(typeof data.response).toBe('string');
        expect(data.response.length).toBeGreaterThan(0);
        expect(data.otelContext.extracted).toBe(true);
        expect(data.otelContext.message).toBe('OTEL trace context was successfully extracted from headers');

        // Verify both traceparent and tracestate were extracted
        expect(data.otelContext.headers).toBeDefined();
        expect(data.otelContext.headers.traceparent).toBe(traceparent);
        expect(data.otelContext.headers.tracestate).toBe(tracestate);
      },
    );

    it('should return 400 for missing message', { skip: !process.env.OPENAI_API_KEY }, async () => {
      const response = await fetch(`http://localhost:${testPort}${framework.routePrefix}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Message is required' });
    });
  });
}

// Run tests for all frameworks
frameworks.forEach(framework => runFrameworkTests(framework));
