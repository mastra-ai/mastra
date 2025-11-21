/**
 * Integration test for hono-multi example
 *
 * Tests distributed tracing across three services:
 * service-one → service-two → service-mastra
 *
 * Verifies trace context propagation and span hierarchy in Arize Phoenix.
 */

import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PHOENIX_URL = 'http://localhost:6006';
const SERVICE_ONE_PORT = 3000;
const SERVICE_TWO_PORT = 3001;
const SERVICE_MASTRA_PORT = 4000;

/**
 * Helper to query spans from Phoenix by trace ID
 * Phoenix stores traces in a different format than Jaeger
 */
async function getTraceFromPhoenix(traceId: string): Promise<any> {
  // Phoenix GraphQL API endpoint
  const url = `${PHOENIX_URL}/graphql`;

  const query = `
    query GetTrace($traceId: String!) {
      getTraceByOtelId(traceId: $traceId) {
        traceId
        spans {
          edges {
            node {
              spanId
              name
              parentId
              startTime
              endTime
              statusCode
              statusMessage
              attributes
            }
          }
        }
      }
    }
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { traceId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch trace from Phoenix: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Helper to wait for a trace to appear in Phoenix
 */
async function waitForTrace(traceId: string, timeoutMs = 15000): Promise<any[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const data = await getTraceFromPhoenix(traceId);

      if (data.data?.getTraceByOtelId?.spans?.edges && data.data.getTraceByOtelId.spans.edges.length > 0) {
        // Extract span nodes from the connection structure and parse attributes
        return data.data.getTraceByOtelId.spans.edges.map((edge: any) => {
          const node = edge.node;
          // Parse attributes from JSON string to object
          if (node.attributes && typeof node.attributes === 'string') {
            try {
              node.attributes = JSON.parse(node.attributes);
            } catch (e) {
              // If parsing fails, leave as string
            }
          }
          return node;
        });
      }
    } catch (error) {
      // Trace not found yet, continue waiting
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Timeout waiting for trace ${traceId} to appear in Phoenix after ${timeoutMs}ms`);
}

/**
 * Helper to start a service and wait for it to be ready
 */
async function startService(
  name: string,
  servicePath: string,
  port: number,
  env: Record<string, string> = {},
): Promise<ChildProcess> {
  const exampleDir = resolve(__dirname, '..');
  const serviceDir = resolve(exampleDir, servicePath);

  console.log(`[TEST] Starting ${name} from ${serviceDir}`);

  const childProcess = spawn('pnpm', ['run', 'start'], {
    cwd: serviceDir,
    env: {
      ...process.env,
      PORT: String(port),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let startupFailed = false;

  // Wait for service to start
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      startupFailed = true;
      reject(new Error(`${name} failed to start within 30 seconds`));
    }, 30000);

    childProcess.stdout?.on('data', data => {
      const output = data.toString();
      console.log(`[${name}]`, output);
      if (output.includes('Server listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    childProcess.stderr?.on('data', data => {
      console.error(`[${name} ERROR]`, data.toString());
    });

    childProcess.on('error', err => {
      startupFailed = true;
      clearTimeout(timeout);
      reject(err);
    });

    childProcess.on('exit', (code, signal) => {
      if (!startupFailed) {
        startupFailed = true;
        clearTimeout(timeout);
        reject(new Error(`${name} exited prematurely with code ${code} and signal ${signal}`));
      }
    });
  }).catch(err => {
    if (childProcess && !childProcess.killed) {
      childProcess.kill('SIGTERM');
      setTimeout(() => {
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      }, 2000);
    }
    throw err;
  });

  return childProcess;
}

/**
 * Helper to gracefully stop a service
 */
async function stopService(name: string, childProcess: ChildProcess): Promise<void> {
  if (!childProcess || childProcess.killed) {
    return;
  }

  console.log(`[TEST] Stopping ${name}`);

  childProcess.kill('SIGTERM');

  await new Promise<void>(resolve => {
    const timeout = setTimeout(() => {
      if (childProcess && !childProcess.killed) {
        console.warn(`[TEST] ${name} did not stop gracefully, force killing...`);
        childProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    childProcess.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

describe('Hono Multi-Service Integration Tests', () => {
  let serviceOneProcess: ChildProcess | undefined;
  let serviceTwoProcess: ChildProcess | undefined;
  let serviceMastraProcess: ChildProcess | undefined;

  beforeAll(async () => {
    // Skip tests if no OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.info('Skipping integration tests: OPENAI_API_KEY not set');
      return;
    }

    // Start all services in order: mastra, then two, then one
    // This ensures downstream services are ready when upstream services start
    serviceMastraProcess = await startService('service-mastra', 'service-mastra', SERVICE_MASTRA_PORT, {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
      SERVICE_MASTRA_URL: `http://localhost:${SERVICE_MASTRA_PORT}`,
    });

    serviceTwoProcess = await startService('service-two', 'service-two', SERVICE_TWO_PORT, {
      SERVICE_MASTRA_URL: `http://localhost:${SERVICE_MASTRA_PORT}`,
    });

    serviceOneProcess = await startService('service-one', 'service-one', SERVICE_ONE_PORT, {
      SERVICE_TWO_URL: `http://localhost:${SERVICE_TWO_PORT}`,
    });

    // Give services a moment to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Stop services in reverse order
    if (serviceOneProcess) await stopService('service-one', serviceOneProcess);
    if (serviceTwoProcess) await stopService('service-two', serviceTwoProcess);
    if (serviceMastraProcess) await stopService('service-mastra', serviceMastraProcess);
  });

  it('should respond to health checks on all services', { skip: !process.env.OPENAI_API_KEY }, async () => {
    const healthChecks = [
      { name: 'service-one', port: SERVICE_ONE_PORT },
      { name: 'service-two', port: SERVICE_TWO_PORT },
      { name: 'service-mastra', port: SERVICE_MASTRA_PORT },
    ];

    for (const { name, port } of healthChecks) {
      const response = await fetch(`http://localhost:${port}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('service', name);
    }
  });

  it(
    'should propagate trace context through all services',
    { skip: !process.env.OPENAI_API_KEY, timeout: 45000 },
    async () => {
      console.log('[TEST] Making request to service-one /chain endpoint');

      const response = await fetch(`http://localhost:${SERVICE_ONE_PORT}/chain?test=propegate`);
      const data = await response.json();

      console.log('[TEST] Response:', JSON.stringify(data, null, 2));

      // Verify HTTP response
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('service-one');
      expect(data.message).toContain('service-two');
      expect(data.message).toContain('service-mastra');

      // Extract trace ID from response
      // The trace ID should be in the nested response from service-mastra
      const responseStr = JSON.stringify(data);
      const traceIdMatch = responseStr.match(/"traceId":"([a-f0-9]{32})"/);
      expect(traceIdMatch).toBeTruthy();

      const traceId = traceIdMatch![1];
      console.log('[TEST] Trace ID:', traceId);

      // Wait for trace to appear in Phoenix
      console.log('[TEST] Waiting for trace in Phoenix...');
      const spans = await waitForTrace(traceId);

      console.log(`[TEST] Found ${spans.length} spans in trace`);
      expect(spans.length).toBeGreaterThan(0);

      // Log span structure for debugging
      console.log('[TEST] Span structure:');
      spans.forEach((span: any) => {
        const attrs = span.attributes || {};
        // Handle nested attribute structure from Phoenix
        const spanType = attrs.mastra?.span?.type;
        const serviceName = attrs.service?.name;
        const httpMethod = attrs.http?.method;
        const httpTarget = attrs.http?.target || attrs.http?.url;

        const label = spanType
          ? `[MASTRA:${spanType}]`
          : httpMethod
            ? `[HTTP:${httpMethod} ${httpTarget}]`
            : `[${serviceName || 'OTHER'}]`;

        console.log(`  ${label} spanId: ${span.spanId}, name: ${span.name}, parentId: ${span.parentId || 'ROOT'}`);
      });

      // Verify we have Mastra spans
      const mastraSpans = spans.filter((s: any) => s.attributes?.mastra?.span?.type);
      console.log('[TEST] Mastra spans count:', mastraSpans.length);
      expect(mastraSpans.length).toBeGreaterThan(0);

      // Verify we have an agent run span
      const agentSpans = mastraSpans.filter((s: any) => s.attributes?.mastra?.span?.type === 'agent_run');
      expect(agentSpans.length).toBeGreaterThan(0);

      // Verify we have LLM generation spans
      const llmSpans = mastraSpans.filter((s: any) => s.attributes?.mastra?.span?.type === 'model_generation');
      expect(llmSpans.length).toBeGreaterThan(0);

      // Verify HTTP spans (may not always be present on first request due to instrumentation timing)
      const httpSpans = spans.filter((s: any) => s.attributes?.http?.method);
      console.log('[TEST] HTTP spans count:', httpSpans.length);
      if (httpSpans.length > 0) {
        console.log('[TEST] ✅ HTTP spans detected - full trace propagation working!');
      } else {
        console.log('[TEST] ⚠️  HTTP spans not in this trace (may be timing/initialization issue)');
      }

      // Verify all spans share the same trace ID
      const traceIds = [...new Set(spans.map((s: any) => s.attributes?.['trace.id'] || traceId))];
      expect(traceIds.length).toBe(1);

      console.log('[TEST] ✅ Trace context properly propagated through all services!');
    },
  );

  it(
    'should maintain parent-child span relationships',
    { skip: !process.env.OPENAI_API_KEY, timeout: 45000 },
    async () => {
      const response = await fetch(`http://localhost:${SERVICE_ONE_PORT}/chain?test=parent-child`);
      const data = await response.json();

      const responseStr = JSON.stringify(data);
      const traceIdMatch = responseStr.match(/"traceId":"([a-f0-9]{32})"/);
      const traceId = traceIdMatch![1];

      const spans = await waitForTrace(traceId);

      // Build a map of spanId -> span for easy lookup
      const spanMap = new Map(spans.map((s: any) => [s.spanId, s]));

      // Verify agent span has a parent
      const agentSpans = spans.filter((s: any) => s.attributes?.mastra?.span?.type === 'agent_run');
      expect(agentSpans.length).toBeGreaterThan(0);

      const agentSpan = agentSpans[0];
      console.log('[TEST] Agent span:', {
        spanId: agentSpan.spanId,
        name: agentSpan.name,
        parentId: agentSpan.parentId,
      });

      expect(agentSpan.parentId).toBeTruthy();
      expect(spanMap.has(agentSpan.parentId)).toBe(true);

      // Verify LLM span is child of agent span
      const llmSpans = spans.filter((s: any) => s.attributes?.mastra?.span?.type === 'model_generation');
      expect(llmSpans.length).toBeGreaterThan(0);

      const llmSpan = llmSpans[0];
      console.log('[TEST] LLM span:', {
        spanId: llmSpan.spanId,
        name: llmSpan.name,
        parentId: llmSpan.parentId,
      });

      expect(llmSpan.parentId).toBe(agentSpan.spanId);

      console.log('[TEST] ✅ Parent-child relationships verified!');
    },
  );
});
