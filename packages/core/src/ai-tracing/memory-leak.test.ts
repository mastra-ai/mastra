/**
 * Memory leak test for AI tracing with large payloads.
 *
 * This test simulates the scenario where agents process large payloads
 * (e.g., 1MB+ base64-encoded images) repeatedly. Without bounded serialization,
 * these large payloads would be stored in span attributes and cause OOM.
 *
 * The test runs 20 iterations and verifies heap stays under 1000MB.
 */

import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';

import { clearAITracingRegistry, shutdownAITracingRegistry } from './registry';
import type { AITracingExporter, AITracingEvent } from './types';

/**
 * Minimal test exporter that captures events without storing large data.
 */
class MinimalTestExporter implements AITracingExporter {
  name = 'minimal-test-exporter';
  eventCount = 0;

  async exportEvent(_event: AITracingEvent) {
    this.eventCount++;
  }

  async shutdown() {}

  reset() {
    this.eventCount = 0;
  }
}

/**
 * Generate a large base64-like string to simulate image data.
 * Creates approximately 1MB of data.
 */
function generateLargePayload(sizeInBytes: number = 1024 * 1024): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = 'data:image/png;base64,';
  for (let i = 0; i < sizeInBytes; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get current heap usage in MB.
 */
function getHeapUsageMB(): number {
  if (typeof global.gc === 'function') {
    global.gc();
  }
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

describe('AI Tracing Memory Leak Tests', () => {
  let testExporter: MinimalTestExporter;
  let otelProvider: NodeTracerProvider;
  let otelExporter: InMemorySpanExporter;

  beforeEach(() => {
    clearAITracingRegistry();
    testExporter = new MinimalTestExporter();

    // Set up OpenTelemetry tracer provider to activate @withSpan decorators
    otelExporter = new InMemorySpanExporter();
    otelProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(otelExporter)],
    });
    otelProvider.register();

    // Mark telemetry as loaded to suppress warning
    (globalThis as any).___MASTRA_TELEMETRY___ = true;
  });

  afterEach(async () => {
    await shutdownAITracingRegistry();

    // Clean up OpenTelemetry
    await otelProvider.shutdown();
    otelExporter.reset();

    // Reset global telemetry flag
    (globalThis as any).___MASTRA_TELEMETRY___ = false;
  });

  it('should not leak memory when processing large payloads repeatedly', async () => {
    const ITERATIONS = 20;
    const MAX_HEAP_MB = 1000;
    const PAYLOAD_SIZE = 1024 * 1024; // 1MB payload per iteration

    // Create a mock model that returns large payloads (simulating image responses)
    const largePayload = generateLargePayload(PAYLOAD_SIZE);

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: `Response with data: ${largePayload.slice(0, 100)}...` }],
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'response-metadata', id: '1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-delta', id: '1', delta: `Response with data: ${largePayload.slice(0, 100)}...` },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
        ]),
      }),
    });

    const testAgent = new Agent({
      name: 'Memory Test Agent',
      instructions: 'You are a test agent for memory leak testing',
      model: mockModel,
    });

    const mastra = new Mastra({
      telemetry: { enabled: true }, // Enable telemetry to test @withSpan decorator serialization
      storage: new MockStore(),
      observability: {
        configs: {
          test: {
            serviceName: 'memory-leak-tests',
            exporters: [testExporter],
          },
        },
      },
      agents: { testAgent },
    });

    const agent = mastra.getAgent('testAgent');

    const initialHeap = getHeapUsageMB();

    // Run iterations with large payloads
    for (let i = 0; i < ITERATIONS; i++) {
      // Create a prompt with the large payload (simulating sending an image)
      const prompt = `Process this image data: ${largePayload}`;

      const result = await agent.generate(prompt);
      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      // Allow garbage collection between iterations
      if (typeof global.gc === 'function') {
        global.gc();
      }

      // Check memory during iterations to fail fast on leaks
      const currentHeap = getHeapUsageMB();
      expect(
        currentHeap,
        `Memory leak detected at iteration ${i + 1}: heap ${currentHeap}MB exceeds ${MAX_HEAP_MB}MB`,
      ).toBeLessThan(MAX_HEAP_MB);
    }

    const finalHeap = getHeapUsageMB();

    // Log results for debugging (will only show if test fails or in verbose mode)
    console.log(`Memory test completed: ${ITERATIONS} iterations`);
    console.log(`Initial heap: ${initialHeap}MB, Final heap: ${finalHeap}MB`);
    console.log(`Events captured: ${testExporter.eventCount}`);

    // Verify traces were actually created
    expect(testExporter.eventCount).toBeGreaterThan(0);
  }, 300000); // 5 minute timeout

  it('should not leak memory when streaming large payloads repeatedly', async () => {
    const ITERATIONS = 20;
    const MAX_HEAP_MB = 1000;
    const PAYLOAD_SIZE = 1024 * 1024; // 1MB payload per iteration

    const largePayload = generateLargePayload(PAYLOAD_SIZE);

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: `Response: ${largePayload.slice(0, 100)}...` }],
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'response-metadata', id: '1', modelId: 'mock-model-id', timestamp: new Date(0) },
          // Simulate streaming a large response in chunks
          { type: 'text-delta', id: '1', delta: largePayload.slice(0, 10000) },
          { type: 'text-delta', id: '2', delta: largePayload.slice(10000, 20000) },
          { type: 'text-delta', id: '3', delta: '...' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
        ]),
      }),
    });

    const testAgent = new Agent({
      name: 'Memory Test Agent Stream',
      instructions: 'You are a test agent for memory leak testing',
      model: mockModel,
    });

    const mastra = new Mastra({
      telemetry: { enabled: true }, // Enable telemetry to test @withSpan decorator serialization
      storage: new MockStore(),
      observability: {
        configs: {
          test: {
            serviceName: 'memory-leak-tests-stream',
            exporters: [testExporter],
          },
        },
      },
      agents: { testAgent },
    });

    const agent = mastra.getAgent('testAgent');

    const initialHeap = getHeapUsageMB();

    // Run streaming iterations with large payloads
    for (let i = 0; i < ITERATIONS; i++) {
      const prompt = `Process this image data: ${largePayload}`;

      const result = await agent.stream(prompt);
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      expect(fullText).toBeDefined();
      expect(result.traceId).toBeDefined();

      // Allow garbage collection between iterations
      if (typeof global.gc === 'function') {
        global.gc();
      }

      // Check memory during iterations to fail fast on leaks
      const currentHeap = getHeapUsageMB();
      expect(
        currentHeap,
        `Memory leak detected at iteration ${i + 1}: heap ${currentHeap}MB exceeds ${MAX_HEAP_MB}MB`,
      ).toBeLessThan(MAX_HEAP_MB);
    }

    const finalHeap = getHeapUsageMB();

    console.log(`Stream memory test completed: ${ITERATIONS} iterations`);
    console.log(`Initial heap: ${initialHeap}MB, Final heap: ${finalHeap}MB`);
    console.log(`Events captured: ${testExporter.eventCount}`);

    // Verify traces were actually created
    expect(testExporter.eventCount).toBeGreaterThan(0);
  }, 300000); // 5 minute timeout
});
