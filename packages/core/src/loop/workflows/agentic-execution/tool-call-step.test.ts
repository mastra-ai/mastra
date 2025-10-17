import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { MessageList } from '../../../agent/message-list';
import { ChunkFrom } from '../../../stream/types';
import { createToolCallStep } from './tool-call-step';

describe('createToolCallStep tool approval workflow', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let tools: Record<string, { execute: Mock }>;
  let messageList: MessageList;
  let toolCallStep: ReturnType<typeof createToolCallStep>;
  let neverResolve: Promise<never>;

  // Helper functions to reduce duplication
  const makeInputData = () => ({
    toolCallId: 'test-call-id',
    toolName: 'test-tool',
    args: { param: 'test' },
  });

  const expectNoToolExecution = () => {
    expect(tools['test-tool'].execute).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
    };
    neverResolve = new Promise(() => {});
    suspend = vi.fn().mockReturnValue(neverResolve);
    streamState = {
      serialize: vi.fn().mockReturnValue('serialized-state'),
    };
    tools = {
      'test-tool': {
        execute: vi.fn(),
      },
    };
    messageList = {
      get: {
        input: {
          aiV5: {
            model: () => [],
          },
        },
      },
    } as unknown as MessageList;

    toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should enqueue approval message and prevent execution when approval is required', async () => {
    // Arrange: Set up tool call input data
    const inputData = makeInputData();

    // Act: Execute the tool call step
    const executePromise = toolCallStep.execute({ inputData, suspend });

    // Assert: Verify approval flow and execution prevention
    expect(controller.enqueue).toHaveBeenCalledWith({
      type: 'tool-call-approval',
      runId: 'test-run',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'test' },
      },
    });

    expect(suspend).toHaveBeenCalledWith({
      requireToolApproval: {
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'test' },
      },
      __streamState: 'serialized-state',
    });

    expectNoToolExecution();

    // Verify execution remains suspended
    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('should handle declined tool calls without executing the tool', async () => {
    // Arrange: Set up tool call input data and declined resumeData
    const inputData = makeInputData();
    const resumeData = { approved: false };

    // Act: Execute the tool call step with declined approval
    const result = await toolCallStep.execute({ inputData, suspend, resumeData });

    // Assert: Verify error handling and execution prevention
    expect(result).toEqual({
      error: expect.any(Error),
      ...inputData,
    });
    expect(result.error.message).toContain('Tool call was declined');
    expect(result.error.message).toContain(
      JSON.stringify({
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'test' },
      }),
    );
    expectNoToolExecution();
  });

  it('executes the tool and returns result when approval is granted', async () => {
    // Arrange: Set up input data and mock tool execution result
    const inputData = makeInputData();
    const toolResult = { success: true, data: 'test-result' };
    tools['test-tool'].execute.mockResolvedValue(toolResult);
    const resumeData = { approved: true };

    // Act: Execute tool call step with approval
    const result = await toolCallStep.execute({ inputData, suspend, resumeData });

    // Assert: Verify tool execution and return value
    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        toolCallId: inputData.toolCallId,
        messages: [],
        resumeData,
      }),
    );
    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({
      result: toolResult,
      ...inputData,
    });
  });
});
