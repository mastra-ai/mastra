import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowStreamHandlerParams } from '../workflow-route';
import { handleWorkflowStream } from '../workflow-route';

describe('handleWorkflowStream', () => {
  const mockStreamOutput = {
    fullStream: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
  };

  const mockRun = {
    stream: vi.fn().mockReturnValue(mockStreamOutput),
    resumeStream: vi.fn().mockReturnValue(mockStreamOutput),
  };

  const mockWorkflow = {
    createRun: vi.fn().mockResolvedValue(mockRun),
  };

  const mockMastra = {
    getWorkflowById: vi.fn().mockReturnValue(mockWorkflow),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMastra.getWorkflowById.mockReturnValue(mockWorkflow);
    mockWorkflow.createRun.mockResolvedValue(mockRun);
    mockRun.stream.mockReturnValue(mockStreamOutput);
    mockRun.resumeStream.mockReturnValue(mockStreamOutput);
  });

  it('WorkflowStreamHandlerParams should accept initialState', () => {
    // This test verifies the type accepts initialState.
    // If the type is missing initialState, this will fail TypeScript compilation.
    const params: WorkflowStreamHandlerParams = {
      inputData: { test: true },
      initialState: { counter: 0 },
    };
    expect(params.initialState).toEqual({ counter: 0 });
  });

  it('should pass initialState through to run.stream()', async () => {
    const initialState = { counter: 0, items: ['a', 'b'] };

    await handleWorkflowStream({
      mastra: mockMastra as any,
      workflowId: 'test-workflow',
      params: {
        runId: 'test-run',
        inputData: { foo: 'bar' },
        initialState,
      } as WorkflowStreamHandlerParams,
    });

    expect(mockRun.stream).toHaveBeenCalledTimes(1);
    const streamCallArgs = mockRun.stream.mock.calls[0]![0];
    expect(streamCallArgs).toHaveProperty('initialState');
    expect(streamCallArgs.initialState).toEqual(initialState);
  });

  it('should pass inputData to run.stream() when no resumeData', async () => {
    const params: WorkflowStreamHandlerParams = {
      runId: 'test-run',
      inputData: { foo: 'bar' },
    };

    await handleWorkflowStream({
      mastra: mockMastra as any,
      workflowId: 'test-workflow',
      params,
    });

    expect(mockRun.stream).toHaveBeenCalledTimes(1);
    const streamCallArgs = mockRun.stream.mock.calls[0]![0];
    expect(streamCallArgs.inputData).toEqual({ foo: 'bar' });
  });

  it('should call resumeStream when resumeData is provided', async () => {
    const params: WorkflowStreamHandlerParams = {
      runId: 'test-run',
      resumeData: { answer: 42 },
      step: 'step1',
    };

    await handleWorkflowStream({
      mastra: mockMastra as any,
      workflowId: 'test-workflow',
      params,
    });

    expect(mockRun.resumeStream).toHaveBeenCalledTimes(1);
    expect(mockRun.stream).not.toHaveBeenCalled();
  });
});
