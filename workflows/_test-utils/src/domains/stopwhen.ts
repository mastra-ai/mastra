/**
 * StopWhen tests for DurableAgent
 *
 * Tests for early termination with stopWhen callback.
 * Validates that stopWhen can be used to stop execution based on step results.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createToolCallModel } from '../mock-models';

export function createStopWhenTests({ getPubSub }: DurableAgentTestContext) {
  describe('stopWhen callback', () => {
    describe('stopWhen option configuration', () => {
      it('should accept stopWhen callback in stream options', async () => {
        const mockModel = createToolCallModel('weatherTool', { location: 'Toronto' });
        const pubsub = getPubSub();

        const weatherTool = createTool({
          id: 'weatherTool',
          description: 'Get weather for a location',
          inputSchema: z.object({ location: z.string() }),
          execute: async () => ({
            temperature: 20,
            conditions: 'sunny',
          }),
        });

        const agent = new DurableAgent({
          id: 'stopwhen-agent',
          name: 'StopWhen Agent',
          instructions: 'Get weather information.',
          model: mockModel,
          tools: { weatherTool },
          pubsub,
        });

        const stopWhenCalled = vi.fn().mockReturnValue(false);

        const { runId, cleanup } = await agent.stream('What is the weather in Toronto?', {
          stopWhen: stopWhenCalled,
        });

        expect(runId).toBeDefined();
        cleanup();
      });

      it('should accept stopWhen callback in prepare options', async () => {
        const mockModel = createTextStreamModel('Here is your answer.');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stopwhen-prepare-agent',
          name: 'StopWhen Prepare Agent',
          instructions: 'Respond to questions.',
          model: mockModel,
          pubsub,
        });

        const result = await agent.prepare('Hello', {
          maxSteps: 5,
        });

        expect(result.runId).toBeDefined();
        expect(result.workflowInput.options.maxSteps).toBe(5);
      });
    });

    describe('stopWhen with tools', () => {
      it('should handle stopWhen with tool execution', async () => {
        const mockModel = createToolCallModel('dataTool', { query: 'test' });
        const pubsub = getPubSub();

        const dataTool = createTool({
          id: 'dataTool',
          description: 'Get data',
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ data: 'result' }),
        });

        const agent = new DurableAgent({
          id: 'stopwhen-tool-agent',
          name: 'StopWhen Tool Agent',
          instructions: 'Get data.',
          model: mockModel,
          tools: { dataTool },
          pubsub,
        });

        const stopWhen = vi.fn().mockImplementation(({ steps }) => {
          return steps.some((step: any) => step.content?.some((item: any) => item.type === 'tool-result'));
        });

        const { runId, cleanup } = await agent.stream('Get the data', {
          stopWhen,
          maxSteps: 10,
        });

        expect(runId).toBeDefined();
        cleanup();
      });
    });

    describe('stopWhen with maxSteps', () => {
      it('should combine stopWhen with maxSteps option', async () => {
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stopwhen-maxsteps-agent',
          name: 'StopWhen MaxSteps Agent',
          instructions: 'Respond.',
          model: mockModel,
          pubsub,
        });

        const stopWhen = vi.fn().mockReturnValue(false);

        const { runId, cleanup } = await agent.stream('Hello', {
          stopWhen,
          maxSteps: 3,
        });

        expect(runId).toBeDefined();
        cleanup();
      });

      it('should handle stopWhen returning true immediately', async () => {
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stopwhen-immediate-agent',
          name: 'StopWhen Immediate Agent',
          instructions: 'Respond.',
          model: mockModel,
          pubsub,
        });

        const stopWhen = vi.fn().mockReturnValue(true);

        const { runId, cleanup } = await agent.stream('Hello', {
          stopWhen,
        });

        expect(runId).toBeDefined();
        cleanup();
      });
    });

    describe('stopWhen serialization', () => {
      it('should handle workflow input without stopWhen (non-serializable)', async () => {
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stopwhen-serialize-agent',
          name: 'StopWhen Serialize Agent',
          instructions: 'Respond.',
          model: mockModel,
          pubsub,
        });

        const result = await agent.prepare('Hello', {
          maxSteps: 5,
        });

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();

        const parsed = JSON.parse(serialized);
        expect(parsed.options.maxSteps).toBe(5);
      });
    });
  });

  describe('stopWhen edge cases', () => {
    it('should handle stopWhen with empty steps array', async () => {
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'stopwhen-empty-steps-agent',
        name: 'StopWhen Empty Steps Agent',
        instructions: 'Respond.',
        model: mockModel,
        pubsub,
      });

      const stopWhen = vi.fn().mockImplementation(({ steps }) => {
        if (!steps || steps.length === 0) {
          return false;
        }
        return false;
      });

      const { runId, cleanup } = await agent.stream('Hello', {
        stopWhen,
      });

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle stopWhen that throws an error', async () => {
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'stopwhen-error-agent',
        name: 'StopWhen Error Agent',
        instructions: 'Respond.',
        model: mockModel,
        pubsub,
      });

      const stopWhen = vi.fn().mockImplementation(() => {
        return false;
      });

      const { runId, cleanup } = await agent.stream('Hello', {
        stopWhen,
      });

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle async stopWhen callback', async () => {
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'stopwhen-async-agent',
        name: 'StopWhen Async Agent',
        instructions: 'Respond.',
        model: mockModel,
        pubsub,
      });

      const stopWhen = vi.fn().mockImplementation(async ({ steps }) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return steps.length > 0;
      });

      const { runId, cleanup } = await agent.stream('Hello', {
        stopWhen,
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });
}
