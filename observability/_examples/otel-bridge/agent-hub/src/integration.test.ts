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
const TEST_PORT = 3003;
const JAEGER_URL = 'http://localhost:16686';

/**
 * Helper to check if Jaeger is available
 */
async function checkJaegerAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${JAEGER_URL}/api/services`, {signal: AbortSignal.timeout(5000)});
    return response.ok;
  } catch {
    return false;
  }
}

// Check prerequisites at module load time (before tests are defined)
const jaegerAvailable = await checkJaegerAvailability();
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const shouldSkip = !jaegerAvailable || !hasOpenAIKey;

if (!jaegerAvailable) {
  console.info('Skipping integration tests: Jaeger not available at', JAEGER_URL);
}
if (!hasOpenAIKey) {
  console.info('Skipping integration tests: OPENAI_API_KEY not set');
}

/**
 * Helper to query a specific trace from Jaeger by trace ID
 */
async function getTraceById(traceId: string): Promise<any> {
  const url = `${JAEGER_URL}/api/traces/${traceId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch trace from Jaeger: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Helper to wait for a specific trace to appear in Jaeger
 * Returns all spans from that trace
 */
async function waitForTrace(traceId: string, timeoutMs = 10000): Promise<any[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const data = await getTraceById(traceId);

      // Extract spans from the trace
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const trace = data.data[0];
        if (trace.spans && Array.isArray(trace.spans) && trace.spans.length > 0) {
          return trace.spans;
        }
      }
    } catch (error) {
      // Trace not found yet, continue waiting
    }

    // Wait a bit before retrying
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timeout waiting for trace ${traceId} to appear in Jaeger`);
}

describe('Agent Hub Integration Tests', () => {
  let serverProcess: ChildProcess | undefined;

  beforeAll(async () => {
    // Skip server startup if prerequisites not met
    if (shouldSkip) {
      return;
    }

    const exampleDir = resolve(__dirname, '..');

    serverProcess = spawn('pnpm', ['run', 'start'], {
      env: {
        ...process.env,
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

        console.log(output);
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

  it('should respond to health check', {skip: shouldSkip}, async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/ping`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
  });

  it('should handle demo request without OTEL trace context', {skip: shouldSkip, timeout: 30000}, async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/demo/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({message: 'Say hello in 5 words or less'}),
    });

    const data = await response.json();

    // Verify HTTP response
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('response');
    expect(typeof data.response).toBe('string');
    expect(data.response.length).toBeGreaterThan(0);
    expect(data).toHaveProperty('traceId');

    console.log('=== DEBUG: Response traceId:', data.traceId);

    // Wait for the specific trace to appear in Jaeger
    const traceSpans = await waitForTrace(data.traceId, 15000);
    console.log('=== DEBUG: Found', traceSpans.length, 'spans in trace');

    // Note: We could verify HTTP server spans from OTEL auto-instrumentation here
    // (/ping endpoint is ignored by OTEL, so HTTP spans would only be from /demo/v1)
    // but the main focus of this test is on Mastra and OpenAI span hierarchy

    // Debug: Log all spans in this trace
    console.log('=== DEBUG: All spans with structure:');
    traceSpans.forEach((s: any) => {
      const mastraTypeTag = s.tags?.find((t: any) => t.key === 'mastra.span.type');
      const mastraType = mastraTypeTag ? `[MASTRA:${mastraTypeTag.value}]` : '[OTHER]';
      console.log(
        `  ${mastraType} spanID: ${s.spanID}, name: ${s.operationName}, parentID: ${s.references[0]?.spanID || 'ROOT'}`,
      );
    });

    // Should have Mastra spans (identified by mastra.span.type tag)
    const mastraSpans = traceSpans.filter((s: any) => s.tags?.some((t: any) => t.key === 'mastra.span.type'));
    console.log('=== DEBUG: Mastra spans count:', mastraSpans.length);
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

    // Verify all spans share the same trace ID
    const traceIds = [...new Set(traceSpans.map((s: any) => s.traceID))];
    expect(traceIds.length).toBe(1);
    expect(traceIds[0]).toBe(data.traceId);

    // Verify parent-child relationships
    // Agent span should have parent references
    const agentSpan = agentSpans[0];
    console.log('=== DEBUG: Agent span:', {
      spanID: agentSpan.spanID,
      operationName: agentSpan.operationName,
      references: agentSpan.references,
    });
    expect(agentSpan.references).toBeDefined();
    expect(agentSpan.references.length).toBeGreaterThan(0);

    // LLM spans should reference the agent span as parent
    const llmSpan = llmSpans[0];
    console.log('=== DEBUG: LLM span:', {
      spanID: llmSpan.spanID,
      operationName: llmSpan.operationName,
      references: llmSpan.references,
    });
    expect(llmSpan.references).toBeDefined();
    const parentRef = llmSpan.references.find((r: any) => r.refType === 'CHILD_OF');
    expect(parentRef).toBeDefined();
    console.log('=== DEBUG: Parent ref spanID:', parentRef.spanID, 'vs agent spanID:', agentSpan.spanID);
    expect(parentRef.spanID).toBe(agentSpan.spanID);

    // Verify OpenAI API call spans are nested under MODEL_GENERATION span
    // These spans are created by OTEL auto-instrumentation for the HTTP client
    const openaiSpans = traceSpans.filter((s: any) => {
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
            const refSpan = traceSpans.find((rs: any) => rs.spanID === r.spanID);
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
        const parentSpan = traceSpans.find((s: any) => s.spanID === parentSpanId);

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
  });

  it('should extract OTEL trace context from traceparent header', {skip: shouldSkip, timeout: 30000}, async () => {
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';

    const response = await fetch(`http://localhost:${TEST_PORT}/demo/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    // Verify the response includes the inherited trace ID
    expect(data).toHaveProperty('traceId');
    expect(data.traceId).toBe(expectedTraceId);

    // Wait for the specific trace to appear in Jaeger
    const tracedSpans = await waitForTrace(data.traceId, 15000);
    expect(tracedSpans.length).toBeGreaterThan(0);

    // Verify Mastra spans inherited the trace context
    const mastraSpans = tracedSpans.filter((s: any) => s.tags?.some((t: any) => t.key === 'mastra.span.type'));
    expect(mastraSpans.length).toBeGreaterThan(0);

    // All Mastra spans should have the inherited trace ID
    mastraSpans.forEach((span: any) => {
      expect(span.traceID).toBe(data.traceId);
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
  });
});
