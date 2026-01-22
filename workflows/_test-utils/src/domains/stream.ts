/**
 * Stream tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createMultiChunkStreamModel } from '../mock-models';

export function createStreamTests({ getPubSub, eventPropagationDelay }: DurableAgentTestContext) {
  describe('streaming execution', () => {
    describe('basic streaming', () => {
      it('should stream text response and invoke onChunk callback', async () => {
        const mockModel = createTextStreamModel('Hello, world!');
        const chunks: any[] = [];
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stream-test-agent',
          name: 'Stream Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          pubsub,
        });

        const { output, runId, cleanup } = await agent.stream('Say hello', {
          onChunk: chunk => {
            chunks.push(chunk);
          },
        });

        expect(runId).toBeDefined();
        expect(output).toBeDefined();

        // Wait for events to propagate
        await new Promise(resolve => setTimeout(resolve, eventPropagationDelay));

        cleanup();
      });

      it('should stream multiple text chunks', async () => {
        const mockModel = createMultiChunkStreamModel(['Hello', ', ', 'world', '!']);
        const chunks: any[] = [];
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'multi-chunk-agent',
          name: 'Multi Chunk Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          pubsub,
        });

        const { cleanup } = await agent.stream('Say hello in parts', {
          onChunk: chunk => {
            chunks.push(chunk);
          },
        });

        await new Promise(resolve => setTimeout(resolve, eventPropagationDelay));
        cleanup();
      });

      it('should return runId and allow cleanup', async () => {
        const mockModel = createTextStreamModel('Test response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'cleanup-test-agent',
          name: 'Cleanup Test Agent',
          instructions: 'Test',
          model: mockModel,
          pubsub,
        });

        const { runId, cleanup } = await agent.stream('Test');

        expect(runId).toBeDefined();
        expect(typeof runId).toBe('string');
        expect(runId.length).toBeGreaterThan(0);

        // Registry should have the run
        expect(agent.runRegistry.has(runId)).toBe(true);

        // Cleanup should remove from registry
        cleanup();
        expect(agent.runRegistry.has(runId)).toBe(false);
      });
    });
  });

  describe('workflow input serialization', () => {
    it('should create fully serializable workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'serialization-agent',
        name: 'Serialization Agent',
        instructions: 'You are helpful',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Test message');

      // Verify all fields are serializable
      const serialized = JSON.stringify(result.workflowInput);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.runId).toBe(result.runId);
      expect(deserialized.agentId).toBe('serialization-agent');
      expect(deserialized.messageListState).toBeDefined();
      expect(deserialized.modelConfig).toBeDefined();
      expect(deserialized.modelConfig.provider).toBeDefined();
      expect(deserialized.modelConfig.modelId).toBeDefined();
    });

    it('should serialize execution options', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'options-agent',
        name: 'Options Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Test', {
        maxSteps: 5,
        toolChoice: 'auto',
        modelSettings: { temperature: 0.7 },
      });

      expect(result.workflowInput.options.maxSteps).toBe(5);
      expect(result.workflowInput.options.toolChoice).toBe('auto');
      expect(result.workflowInput.options.temperature).toBe(0.7);

      // Verify serializable
      const serialized = JSON.stringify(result.workflowInput.options);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });
}
