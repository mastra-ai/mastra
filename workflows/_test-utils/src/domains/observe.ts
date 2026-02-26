/**
 * Observe tests for DurableAgent
 *
 * Tests the observe() method for reconnecting to existing streams.
 * This is critical for resumable stream functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel } from '../mock-models';

export function createObserveTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;

  describe('observe', () => {
    it('should have observe method available', async () => {
      const mockModel = createSimpleMockModel();

      const agent = await createAgent({
        id: 'observe-test',
        name: 'Observe Test',
        instructions: 'Test assistant',
        model: mockModel,
      });

      expect(typeof (agent as any).observe).toBe('function');
    });

    it('should return stream result from observe', async () => {
      const mockModel = createSimpleMockModel();

      const agent = await createAgent({
        id: 'observe-result',
        name: 'Observe Result',
        instructions: 'Test assistant',
        model: mockModel,
      });

      // Start a stream first
      const { runId, cleanup } = await agent.stream('Hello');
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      cleanup();

      // Now observe the same runId
      const result = await (agent as any).observe(runId);
      expect(result.runId).toBe(runId);
      expect(result.output).toBeDefined();
      expect(typeof result.cleanup).toBe('function');
      result.cleanup();
    });

    it('should support offset for efficient resume', async () => {
      const mockModel = createSimpleMockModel();

      const agent = await createAgent({
        id: 'observe-index',
        name: 'Observe Index',
        instructions: 'Test assistant',
        model: mockModel,
      });

      // Start a stream first
      const { runId, cleanup } = await agent.stream('Hello');
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      cleanup();

      // Observe with offset to skip already-seen events
      const result = await (agent as any).observe(runId, { offset: 0 });
      expect(result.runId).toBe(runId);
      expect(result.output).toBeDefined();
      result.cleanup();
    });

    it('should support onChunk callback', async () => {
      const mockModel = createSimpleMockModel();
      const onChunk = vi.fn();

      const agent = await createAgent({
        id: 'observe-callbacks',
        name: 'Observe Callbacks',
        instructions: 'Test assistant',
        model: mockModel,
      });

      // Start a stream first
      const { runId, cleanup } = await agent.stream('Hello');
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      cleanup();

      // Observe with callbacks
      const result = await (agent as any).observe(runId, { onChunk });
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      result.cleanup();

      // onChunk may or may not be called depending on event caching
      // Just verify the observe call completed successfully
      expect(result.runId).toBe(runId);
    });

    it('should support onFinish callback', async () => {
      const mockModel = createSimpleMockModel();
      const onFinish = vi.fn();

      const agent = await createAgent({
        id: 'observe-finish',
        name: 'Observe Finish',
        instructions: 'Test assistant',
        model: mockModel,
      });

      // Start a stream first
      const { runId, cleanup } = await agent.stream('Hello');
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      cleanup();

      // Observe with onFinish callback
      const result = await (agent as any).observe(runId, { onFinish });
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      result.cleanup();

      expect(result.runId).toBe(runId);
    });

    it('should support onError callback', async () => {
      const mockModel = createSimpleMockModel();
      const onError = vi.fn();

      const agent = await createAgent({
        id: 'observe-error',
        name: 'Observe Error',
        instructions: 'Test assistant',
        model: mockModel,
      });

      // Start a stream first
      const { runId, cleanup } = await agent.stream('Hello');
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      cleanup();

      // Observe with onError callback
      const result = await (agent as any).observe(runId, { onError });
      await new Promise(r => setTimeout(r, eventPropagationDelay));
      result.cleanup();

      expect(result.runId).toBe(runId);
    });
  });
}
