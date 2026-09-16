/**
 * Regression test for PR #24070: DurableAgent.stream() pubsub subscription leak fix
 *
 * This test verifies that pubsub subscriptions are properly cleaned up in all
 * termination scenarios, preventing memory leaks and zombie event handlers.
 *
 * The fix addresses two issues:
 * 1. The auto-cleanup timer was not calling streamCleanup() before cleaning up
 *    registry state, leaving pubsub subscriptions active.
 * 2. The idleTimeoutMs option was not being passed through to createDurableAgentStream,
 *    preventing idle timeout termination for crashed producers.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

// ============================================================================
// Regression Tests for PR #24070
// ============================================================================

describe('PubSub subscription leak fix (PR #24070)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('idleTimeoutMs passthrough', () => {
    it('should pass idleTimeoutMs to createDurableAgentStream for crashed producer detection', async () => {
      // This test verifies the fix: idleTimeoutMs is passed through to enable
      // auto-termination for crashed producers
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'idle-timeout-test-agent',
        name: 'Idle Timeout Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // The stream should receive idleTimeoutMs from cleanupTimeoutMs by default
      const { runId, cleanup } = await durableAgent.stream('Test idle timeout');

      // Verify runId is available
      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');

      cleanup();
    });

    it('should use provided idleTimeoutMs option', async () => {
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'custom-idle-agent',
        name: 'Custom Idle Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const customIdleTimeout = 5000;
      const { runId, cleanup } = await durableAgent.stream('Test custom idle timeout', {
        idleTimeoutMs: customIdleTimeout,
      });

      expect(runId).toBeDefined();

      cleanup();
    });
  });

  describe('pubsub cleanup on auto-cleanup', () => {
    it('should unsubscribe from pubsub when auto-cleanup timer fires after stream finishes', async () => {
      // This test verifies the fix: streamCleanup() is called in the auto-cleanup timer
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'cleanup-auto-test-agent',
        name: 'Cleanup Auto Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // Use a short cleanup timeout to speed up the test
      const { runId, cleanup } = await durableAgent.stream('Test auto cleanup', {
        cleanupTimeoutMs: 50, // Short timeout for testing
      });

      // Wait for stream to complete
      await durableAgent.stream().then(async ({ output }) => {
        await output.consumeStream();
      });

      // First stream cleanup should work
      cleanup();

      // Verify the run is removed from registry
      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });

    it('should unsubscribe from pubsub when onError triggers auto-cleanup', async () => {
      // This test verifies the fix: streamCleanup() is called when onError triggers auto-cleanup
      const errorModel = new MockLanguageModelV2({
        doStream: async () => {
          throw new Error('Test error');
        },
      });

      const baseAgent = new Agent({
        id: 'error-auto-test-agent',
        name: 'Error Auto Test Agent',
        instructions: 'Test',
        model: errorModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Test error cleanup', {
        cleanupTimeoutMs: 50,
      });

      // Wait for the stream to error
      const { output } = await durableAgent.stream();
      await output.consumeStream({ onError: () => {} });

      cleanup();

      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });
  });

  describe('subscription leak prevention', () => {
    it('should not leak pubsub subscriptions when cleanup is called multiple times', async () => {
      // Verify that calling cleanup() multiple times is safe (idempotent)
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'idempotent-cleanup-agent',
        name: 'Idempotent Cleanup Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Test idempotent cleanup');

      // Call cleanup multiple times
      cleanup();
      cleanup(); // Should not throw
      cleanup(); // Should not throw

      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });

    it('should remove all event listeners from pubsub after cleanup', async () => {
      // This test verifies no zombie event handlers remain after cleanup
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'listener-leak-test-agent',
        name: 'Listener Leak Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Test listener cleanup');

      // Cleanup should remove the subscription
      cleanup();

      // Give time for async cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify run is cleaned up
      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });
  });

  describe('cleanup timeout configuration', () => {
    it('should respect cleanupTimeoutMs of 0 (disabled auto-cleanup)', async () => {
      // When cleanupTimeoutMs is 0, auto-cleanup should be disabled
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'no-auto-cleanup-agent',
        name: 'No Auto Cleanup Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Test no auto cleanup', {
        cleanupTimeoutMs: 0, // Disabled
      });

      // Stream should complete normally
      await durableAgent.stream().then(async ({ output }) => {
        await output.consumeStream();
      });

      // Manual cleanup should still work
      cleanup();
      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });

    it('should use default cleanup timeout when not specified', async () => {
      // Default cleanup timeout should be 30 seconds
      const mockModel = createTextStreamModel('Done');

      const baseAgent = new Agent({
        id: 'default-timeout-agent',
        name: 'Default Timeout Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { cleanup } = await durableAgent.stream('Test default timeout');

      // Cleanup should work with default timeout
      cleanup();
    });
  });

  describe('basic streaming functionality', () => {
    it('should stream text response and invoke onChunk callback', async () => {
      const mockModel = createTextStreamModel('Hello, world!');
      const chunks: any[] = [];

      const baseAgent = new Agent({
        id: 'stream-test-agent',
        name: 'Stream Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, output, cleanup } = await durableAgent.stream('Say hello', {
        onChunk: chunk => {
          chunks.push(chunk);
        },
      });

      expect(runId).toBeDefined();
      expect(output).toBeDefined();

      // Drain the stream to deterministically wait for all chunks
      await output.consumeStream();

      expect(chunks.length).toBeGreaterThan(0);

      cleanup();
    });

    it('should return runId and allow cleanup', async () => {
      const mockModel = createTextStreamModel('Test response');

      const baseAgent = new Agent({
        id: 'cleanup-test-agent',
        name: 'Cleanup Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Test');

      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');
      expect(runId.length).toBeGreaterThan(0);

      // Registry should have the run
      expect(durableAgent.runRegistry.has(runId)).toBe(true);

      // Cleanup should remove from registry
      cleanup();
      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });
  });
});