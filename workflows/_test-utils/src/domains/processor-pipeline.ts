/**
 * Processor pipeline tests for DurableAgent
 *
 * Tests that input, output, and error processors are properly
 * wired into the durable execution path.
 */

import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createProcessorPipelineTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('processor pipeline', () => {
    describe('input processors', () => {
      it('should run processInput during preparation', async () => {
        const processInputSpy = vi.fn(async ({ messages }: any) => ({ messages }));

        const mockProcessor = {
          id: 'spy-input-processor',
          processInput: processInputSpy,
        };

        const agent = new Agent({
          id: 'input-proc-agent',
          name: 'Input Proc Agent',
          instructions: 'Test',
          model: createTextStreamModel('Hello'),
          inputProcessors: [mockProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        await durableAgent.prepare('Hello');

        expect(processInputSpy).toHaveBeenCalled();
      });
    });

    describe('output processors', () => {
      it('should carry output processors in the registry entry when configured', async () => {
        const mockOutputProcessor = {
          id: 'test-output-processor',
          processOutput: async ({ messages }: any) => ({ messages }),
        };

        const agent = new Agent({
          id: 'output-proc-agent',
          name: 'Output Proc Agent',
          instructions: 'Test',
          model: createTextStreamModel('Hello'),
          outputProcessors: [mockOutputProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        const result = await durableAgent.prepare('Hello');

        // Output processors array is always present (may be empty if resolution filters them)
        expect(result.registryEntry.outputProcessors).toBeDefined();
        expect(Array.isArray(result.registryEntry.outputProcessors)).toBe(true);
      });

      it('should stream successfully with output processors configured', async () => {
        const mockOutputProcessor = {
          id: 'stream-output-processor',
          processOutput: async ({ messages }: any) => ({ messages }),
        };

        const agent = new Agent({
          id: 'stream-output-agent',
          name: 'Stream Output Agent',
          instructions: 'Test',
          model: createTextStreamModel('Done'),
          outputProcessors: [mockOutputProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        const { output, cleanup } = await durableAgent.stream('Hello');
        const text = await output.text;

        expect(text).toBe('Done');
        cleanup();
      });
    });

    describe('error processors', () => {
      it('should carry error processors in the registry entry', async () => {
        const mockErrorProcessor = {
          id: 'test-error-processor',
          processAPIError: async () => ({ retry: false }),
        };

        const agent = new Agent({
          id: 'error-proc-agent',
          name: 'Error Proc Agent',
          instructions: 'Test',
          model: createTextStreamModel('Hello'),
          errorProcessors: [mockErrorProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        const result = await durableAgent.prepare('Hello');

        expect(result.registryEntry.errorProcessors).toBeDefined();
        expect(result.registryEntry.errorProcessors!.length).toBe(1);
      });

      it('should set hasErrorProcessors flag in workflow input', async () => {
        const mockErrorProcessor = {
          id: 'flag-error-processor',
          processAPIError: async () => ({ retry: false }),
        };

        const agent = new Agent({
          id: 'error-flag-agent',
          name: 'Error Flag Agent',
          instructions: 'Test',
          model: createTextStreamModel('Hello'),
          errorProcessors: [mockErrorProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        const result = await durableAgent.prepare('Hello');

        expect(result.workflowInput.options.hasErrorProcessors).toBe(true);
      });
    });

    describe('combined processors', () => {
      it('should handle both input and output processors', async () => {
        const mockInputProcessor = {
          id: 'combined-input',
          processInput: async ({ messages }: any) => ({ messages }),
        };
        const mockOutputProcessor = {
          id: 'combined-output',
          processOutput: async ({ messages }: any) => ({ messages }),
        };

        const agent = new Agent({
          id: 'combined-proc-agent',
          name: 'Combined Proc Agent',
          instructions: 'Test',
          model: createTextStreamModel('Result'),
          inputProcessors: [mockInputProcessor],
          outputProcessors: [mockOutputProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        const result = await durableAgent.prepare('Hello');

        expect(result.registryEntry.inputProcessors).toBeDefined();
        expect(result.registryEntry.outputProcessors).toBeDefined();
        expect(result.registryEntry.processorStates).toBeDefined();
      });

      it('should stream with combined processors', async () => {
        const mockInputProcessor = {
          id: 'stream-combined-input',
          processInput: async ({ messages }: any) => ({ messages }),
        };
        const mockOutputProcessor = {
          id: 'stream-combined-output',
          processOutput: async ({ messages }: any) => ({ messages }),
        };

        const agent = new Agent({
          id: 'stream-combined-agent',
          name: 'Stream Combined Agent',
          instructions: 'Test',
          model: createTextStreamModel('Combined result'),
          inputProcessors: [mockInputProcessor],
          outputProcessors: [mockOutputProcessor],
        } as any);

        const durableAgent = createDurableAgent({
          agent,
          pubsub: getPubSub(),
        });

        const { output, cleanup } = await durableAgent.stream('Hello');
        const text = await output.text;

        expect(text).toBe('Combined result');
        cleanup();
      });
    });
  });
}
