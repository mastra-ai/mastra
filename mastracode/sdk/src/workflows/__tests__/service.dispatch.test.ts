import type { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import { runWorkflow } from '../service.js';

describe('runWorkflow service dispatch', () => {
  it('uses start when no event callback is requested', async () => {
    const start = vi.fn().mockResolvedValue({ status: 'success', result: { value: 2 } });
    const stream = vi.fn();
    const createRun = vi.fn().mockResolvedValue({ start, stream });
    const mastra = { getWorkflow: vi.fn().mockReturnValue({ createRun }) } as unknown as Mastra;

    await expect(runWorkflow(mastra, 'workflow-id', { value: 1 })).resolves.toEqual({
      status: 'success',
      result: { value: 2 },
    });
    expect(start).toHaveBeenCalledWith({ inputData: { value: 1 }, requestContext: undefined });
    expect(stream).not.toHaveBeenCalled();
  });

  it('uses stream and forwards events when a callback is requested', async () => {
    const event = { type: 'workflow-step-start', runId: 'run-id', payload: { id: 'step-id' } };
    const onEvent = vi.fn();
    const start = vi.fn();
    const stream = vi.fn().mockReturnValue({
      fullStream: new ReadableStream({
        start(controller) {
          controller.enqueue(event);
          controller.close();
        },
      }),
      result: Promise.resolve({ status: 'success', result: { value: 2 } }),
    });
    const createRun = vi.fn().mockResolvedValue({ start, stream });
    const mastra = { getWorkflow: vi.fn().mockReturnValue({ createRun }) } as unknown as Mastra;

    await expect(runWorkflow(mastra, 'workflow-id', { value: 1 }, undefined, onEvent)).resolves.toEqual({
      status: 'success',
      result: { value: 2 },
    });
    expect(stream).toHaveBeenCalledWith({ inputData: { value: 1 }, requestContext: undefined });
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(start).not.toHaveBeenCalled();
  });

  it('preserves the workflow lookup error as the missing-workflow cause', async () => {
    const lookupError = new Error('Workflow construction failed');
    const mastra = {
      getWorkflow: vi.fn(() => {
        throw lookupError;
      }),
    } as unknown as Mastra;

    const error = await runWorkflow(mastra, 'workflow-id', {}).catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      message: 'No workflow registered with id "workflow-id". Was it built and saved?',
      cause: lookupError,
    });
  });
});
