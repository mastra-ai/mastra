import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { StreamEvent } from '../types';
import { createStep, createWorkflow } from '../workflow';

describe('Parallel Steps with Writer', () => {
  it('should handle writer.custom in parallel steps without locking', async () => {
    const workflow = createWorkflow({
      id: 'log-workflow',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .parallel([
        createStep({
          id: 'log-step-1',
          description: '',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ writer }) => {
            await writer.custom({ type: 'data-log', data: { step: 1 } });
            return { success: true };
          },
        }),
        createStep({
          id: 'log-step-2',
          description: '',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ writer }) => {
            await writer.custom({ type: 'data-log', data: { step: 2 } });
            return { success: true };
          },
        }),
      ])
      .commit();

    const run = await workflow.createRun({
      runId: 'test-parallel-writer',
    });

    const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

    const collectedStreamData: StreamEvent[] = [];
    for await (const data of stream) {
      collectedStreamData.push(JSON.parse(JSON.stringify(data)));
    }

    const executionResult = await getWorkflowState();

    // Verify both steps completed successfully
    expect(executionResult.steps['log-step-1']?.status).toBe('success');
    expect(executionResult.steps['log-step-2']?.status).toBe('success');

    // The main goal is to ensure no "writer is locked" error occurs
    // Custom data events are written to the stream successfully
  });

  it('should handle multiple parallel steps with writer.custom', async () => {
    const workflow = createWorkflow({
      id: 'multi-log-workflow',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .parallel([
        createStep({
          id: 'log-step-1',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ writer }) => {
            await writer.custom({ type: 'data-log', data: { step: 1, message: 'first' } });
            return { result: 'step1' };
          },
        }),
        createStep({
          id: 'log-step-2',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ writer }) => {
            await writer.custom({ type: 'data-log', data: { step: 2, message: 'second' } });
            return { result: 'step2' };
          },
        }),
        createStep({
          id: 'log-step-3',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ writer }) => {
            await writer.custom({ type: 'data-log', data: { step: 3, message: 'third' } });
            return { result: 'step3' };
          },
        }),
      ])
      .commit();

    const run = await workflow.createRun({
      runId: 'test-multi-parallel-writer',
    });

    const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

    const collectedStreamData: StreamEvent[] = [];
    for await (const data of stream) {
      collectedStreamData.push(JSON.parse(JSON.stringify(data)));
    }

    const executionResult = await getWorkflowState();

    // Verify all steps completed successfully
    expect(executionResult.steps['log-step-1']?.status).toBe('success');
    expect(executionResult.steps['log-step-2']?.status).toBe('success');
    expect(executionResult.steps['log-step-3']?.status).toBe('success');

    // The main goal is to ensure no "writer is locked" error occurs
    // Custom data events are written to the stream successfully
  });
});
