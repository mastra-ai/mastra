/**
 * Integration test for stripped-agent-hub-export example
 *
 * Tests the complete flow of OTEL context extraction and span creation
 * by starting the example server and making requests to it.
 * Verifies spans by querying the Jaeger API.
 */

import type {ChildProcess} from 'child_process';
import {spawn} from 'child_process';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import {describe, it, expect, beforeAll, afterAll} from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Note: Environment variables should be loaded via vitest config or .env file
const TEST_PORT = process.env.DEFAULT_PORT || 8080;
const TEST_API_KEY = 'test-api-key';
const JAEGER_URL = 'http://localhost:16686';
const SERVICE_NAME = 'genstudio-agent-hub';

/**
 * Helper to query traces from Jaeger by service name
 */
async function getTracesFromJaeger(serviceName: string, limit = 100): Promise<any> {
  const url = `${JAEGER_URL}/api/traces?service=${serviceName}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch traces from Jaeger: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Helper to wait for spans to appear in Jaeger
 * Jaeger may take a moment to ingest and index spans
 */
async function waitForSpans(serviceName: string, minSpanCount: number, timeoutMs = 10000): Promise<any[]> {
  const startTime = Date.now();
  let allSpans: any[] = [];

  while (Date.now() - startTime < timeoutMs) {
    const data = await getTracesFromJaeger(serviceName);
    allSpans = [];

    // Flatten all spans from all traces
    if (data.data && Array.isArray(data.data)) {
      for (const trace of data.data) {
        if (trace.spans && Array.isArray(trace.spans)) {
          allSpans.push(...trace.spans);
        }
      }
    }

    if (allSpans.length >= minSpanCount) {
      return allSpans;
    }

    // Wait a bit before retrying
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timeout waiting for ${minSpanCount} spans in Jaeger. Found ${allSpans.length} spans after ${timeoutMs}ms`,
  );
}

describe('Stripped Agent Hub Export Integration Tests', () => {
  let serverProcess: ChildProcess | undefined;

  beforeAll(async () => {
    // Skip tests if no OpenAI API key is provided
    if (!process.env.OPENAI_API_KEY) {
      console.info('Skipping integration tests: OPENAI_API_KEY not set');
      return;
    }

    const exampleDir = resolve(__dirname, '..');

    // Start the server using npm run start:test (no file watching)
    serverProcess = spawn('npm', ['run', 'start:test'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DEFAULT_PORT: String(TEST_PORT),
      },
      cwd: exampleDir,
    });

    // Ensure server is killed if startup fails
    let startupFailed = false;

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        startupFailed = true;
        reject(new Error('Server failed to start within 30 seconds'));
      }, 30000);

      serverProcess!.stdout?.on('data', data => {
        const output = data.toString();
        // Look for the fastify server listening message
        if (output.includes('Server listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess!.stderr?.on('data', data => {
        const output = data.toString();
        // Log errors but don't fail on warnings
        console.error('Server stderr:', output);
      });

      serverProcess!.on('error', err => {
        startupFailed = true;
        clearTimeout(timeout);
        reject(err);
      });

      serverProcess!.on('exit', (code, signal) => {
        if (!startupFailed) {
          startupFailed = true;
          clearTimeout(timeout);
          reject(new Error(`Server exited prematurely with code ${code} and signal ${signal}`));
        }
      });
    }).catch(err => {
      // Ensure we kill the process if startup failed
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
        // Force kill if it doesn't stop
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL');
          }
        }, 2000);
      }
      throw err;
    });
  });

  afterAll(async () => {
    // Stop the server - ensure cleanup happens
    if (serverProcess && !serverProcess.killed) {
      // Try graceful shutdown first
      serverProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          // Force kill if still running after 5 seconds
          if (serverProcess && !serverProcess.killed) {
            console.warn('Server did not stop gracefully, force killing...');
            serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        serverProcess!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  });

  it('should respond to health check', {skip: !process.env.OPENAI_API_KEY}, async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/ping`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
  });

  it(
    'should handle demo request without OTEL trace context',
    {skip: !process.env.OPENAI_API_KEY, timeout: 30000},
    async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/demo/v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_API_KEY,
        },
        body: JSON.stringify({message: 'Say hello in 5 words or less'}),
      });

      const data = await response.json();

      // Verify HTTP response
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('response');
      expect(typeof data.response).toBe('string');
      expect(data.response.length).toBeGreaterThan(0);

      // Wait for spans to appear in Jaeger (expect at least HTTP + Mastra spans)
      const allSpans = await waitForSpans(SERVICE_NAME, 5, 15000);

      // Filter to recent spans (from this request)
      const recentTime = Date.now() * 1000 - 60000000; // Last minute in microseconds
      const recentSpans = allSpans.filter((s: any) => s.startTime > recentTime);

      // Note: We could verify HTTP server spans from OTEL auto-instrumentation here
      // (/ping endpoint is ignored by OTEL, so HTTP spans would only be from /demo/v1)
      // but the main focus of this test is on Mastra and OpenAI span hierarchy

      // Should have Mastra spans (identified by mastra.span.type tag)
      const mastraSpans = recentSpans.filter((s: any) => s.tags?.some((t: any) => t.key === 'mastra.span.type'));
      expect(mastraSpans.length).toBeGreaterThan(0);

      // Should have an agent run span
      const agentSpans = mastraSpans.filter((s: any) =>
        s.tags?.some((t: any) => t.key === 'mastra.span.type' && t.value === 'agent_run'),
      );
      expect(agentSpans.length).toBeGreaterThan(0);

      // Should have LLM generation spans
      const llmSpans = mastraSpans.filter((s: any) =>
        s.tags?.some((t: any) => t.key === 'mastra.span.type' && t.value === 'model_generation'),
      );
      expect(llmSpans.length).toBeGreaterThan(0);

      // Verify spans share the same trace ID
      const traceIds = [...new Set(recentSpans.map((s: any) => s.traceID))];
      expect(traceIds.length).toBeGreaterThan(0);

      // Verify parent-child relationships
      // Agent span should have parent references
      const agentSpan = agentSpans[0];
      expect(agentSpan.references).toBeDefined();
      expect(agentSpan.references.length).toBeGreaterThan(0);

      // LLM spans should reference the agent span as parent
      const llmSpan = llmSpans[0];
      expect(llmSpan.references).toBeDefined();
      const parentRef = llmSpan.references.find((r: any) => r.refType === 'CHILD_OF');
      expect(parentRef).toBeDefined();
      expect(parentRef.spanID).toBe(agentSpan.spanID);

      // Verify OpenAI API call spans are nested under MODEL_GENERATION span
      // These spans are created by OTEL auto-instrumentation for the HTTP client
      const openaiSpans = recentSpans.filter((s: any) => {
        const tags = s.tags || [];
        const netPeerName = tags.find((t: any) => t.key === 'net.peer.name')?.value;
        const httpUrl = tags.find((t: any) => t.key === 'http.url')?.value;
        const operationName = s.operationName || '';

        // Match spans related to api.openai.com
        return (
          netPeerName === 'api.openai.com' ||
          (httpUrl && httpUrl.includes('api.openai.com')) ||
          operationName === 'dns.lookup' ||
          operationName === 'tls.connect' ||
          (operationName === 'POST' &&
            s.references?.some((r: any) => {
              const refSpan = recentSpans.find((rs: any) => rs.spanID === r.spanID);
              return refSpan?.tags?.some((t: any) => t.key === 'mastra.span.type' && t.value === 'model_generation');
            }))
        );
      });

      // Should have OpenAI-related spans (POST, dns.lookup, tls.connect, etc.)
      expect(openaiSpans.length).toBeGreaterThan(0);

      // Verify these spans are children of the MODEL_GENERATION span, not demo-controller
      for (const openaiSpan of openaiSpans) {
        const refs = openaiSpan.references || [];
        const childOfRefs = refs.filter((r: any) => r.refType === 'CHILD_OF');

        if (childOfRefs.length > 0) {
          // Find the parent span
          const parentSpanId = childOfRefs[0].spanID;
          const parentSpan = recentSpans.find((s: any) => s.spanID === parentSpanId);

          if (parentSpan) {
            const parentTags = parentSpan.tags || [];
            const parentMastraType = parentTags.find((t: any) => t.key === 'mastra.span.type')?.value;
            const parentOpName = parentSpan.operationName;

            // Parent should either be MODEL_GENERATION or another OpenAI span (like tls.connect -> tcp.connect)
            // But should NOT be demo-controller
            expect(parentOpName).not.toBe('demo-controller');

            // If parent has mastra.span.type, it should be model_generation
            if (parentMastraType) {
              expect(parentMastraType).toBe('model_generation');
            }
          }
        }
      }
    },
  );

  it(
    'should extract OTEL trace context from traceparent header',
    {skip: !process.env.OPENAI_API_KEY, timeout: 30000},
    async () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';

      const response = await fetch(`http://localhost:${TEST_PORT}/demo/v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_API_KEY,
          traceparent,
        },
        body: JSON.stringify({message: 'Say hi in 3 words'}),
      });

      const data = await response.json();

      // Verify HTTP response
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('response');
      expect(typeof data.response).toBe('string');
      expect(data.response.length).toBeGreaterThan(0);

      // Wait for spans to appear in Jaeger
      const allSpans = await waitForSpans(SERVICE_NAME, 5, 15000);

      // Filter to spans with the expected trace ID (proving context propagation)
      const tracedSpans = allSpans.filter((s: any) => s.traceID === expectedTraceId);
      expect(tracedSpans.length).toBeGreaterThan(0);

      // Verify Mastra spans inherited the trace context
      const mastraSpans = tracedSpans.filter((s: any) => s.tags?.some((t: any) => t.key === 'mastra.span.type'));
      expect(mastraSpans.length).toBeGreaterThan(0);

      // All Mastra spans should have the inherited trace ID
      mastraSpans.forEach((span: any) => {
        expect(span.traceID).toBe(expectedTraceId);
      });

      // Should have agent and LLM spans with the propagated trace ID
      const agentSpans = mastraSpans.filter((s: any) =>
        s.tags?.some((t: any) => t.key === 'mastra.span.type' && t.value === 'agent_run'),
      );
      expect(agentSpans.length).toBeGreaterThan(0);

      const llmSpans = mastraSpans.filter((s: any) =>
        s.tags?.some((t: any) => t.key === 'mastra.span.type' && t.value === 'model_generation'),
      );
      expect(llmSpans.length).toBeGreaterThan(0);
    },
  );

  it('should return 400 for missing x-api-key header', {skip: !process.env.OPENAI_API_KEY}, async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/demo/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({message: 'test'}),
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 for missing message', {skip: !process.env.OPENAI_API_KEY}, async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/demo/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_API_KEY,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
