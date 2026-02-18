import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import z from 'zod';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ToolStream } from '../../../tools/stream';
import { createStep } from '../../../workflows';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../../../workflows/constants';
import type { ExecuteFunctionParams } from '../../../workflows/step';
import { createLLMMappingStep } from './llm-mapping-step';

type ToolCallOutput = {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  error?: Error;
  providerMetadata?: Record<string, any>;
  providerExecuted?: boolean;
};

describe('createLLMMappingStep HITL behavior', () => {
  let controller: { enqueue: Mock };
  let messageList: MessageList;
  let llmExecutionStep: any;
  let bail: Mock;
  let getStepResult: Mock;
  let llmMappingStep: ReturnType<typeof createLLMMappingStep>;

  // Helper function to create properly typed execute params
  const createExecuteParams = (
    inputData: ToolCallOutput[],
  ): ExecuteFunctionParams<{}, ToolCallOutput[], any, any, any> => ({
    runId: 'test-run',
    workflowId: 'test-workflow',
    mastra: {} as any,
    requestContext: new RequestContext(),
    state: {},
    setState: vi.fn(),
    retryCount: 1,
    tracingContext: {} as any,
    getInitData: vi.fn(),
    getStepResult,
    suspend: vi.fn(),
    bail,
    abort: vi.fn(),
    engine: 'default' as any,
    abortSignal: new AbortController().signal,
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'test-call-id',
      name: 'test-tool',
      runId: 'test-run',
    }),
    validateSchemas: false,
    inputData,
    [PUBSUB_SYMBOL]: {} as any,
    [STREAM_FORMAT_SYMBOL]: undefined,
  });

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
    };

    messageList = {
      get: {
        all: {
          aiV5: {
            model: () => [],
          },
        },
        input: {
          aiV5: {
            model: () => [],
          },
        },
        response: {
          aiV5: {
            model: () => [],
          },
        },
      },
      add: vi.fn(),
    } as unknown as MessageList;

    llmExecutionStep = createStep({
      id: 'test-llm-execution',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({
        stepResult: {
          isContinued: true,
          reason: undefined,
        },
        metadata: {},
      }),
    });

    bail = vi.fn(data => data);
    getStepResult = vi.fn(() => ({
      stepResult: {
        isContinued: true,
        reason: undefined,
      },
      metadata: {},
    }));

    llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: {
          generateId: () => 'test-message-id',
        },
      } as any,
      llmExecutionStep,
    );
  });

  it('should bail when ALL tools have no result (all HITL tools)', async () => {
    // Arrange: Two tools without execute function (HITL)
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'updateSummary',
        args: { summary: 'test' },
        result: undefined,
      },
      {
        toolCallId: 'call-2',
        toolName: 'updateDescription',
        args: { description: 'test' },
        result: undefined,
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should bail (suspend execution) and NOT emit tool-result chunks
    expect(bail).toHaveBeenCalled();
    expect(controller.enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tool-result' }));
    expect(result.stepResult.isContinued).toBe(false);
  });

  it('should continue when ALL tools have results', async () => {
    // Arrange: Two tools with execute functions
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'updateTitle',
        args: { title: 'test' },
        result: { success: true },
      },
      {
        toolCallId: 'call-2',
        toolName: 'updateStatus',
        args: { status: 'active' },
        result: { success: true },
      },
    ];

    // Act
    await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should NOT bail and SHOULD emit tool-result for both tools
    expect(bail).not.toHaveBeenCalled();
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          result: { success: true },
        }),
      }),
    );
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-2',
          result: { success: true },
        }),
      }),
    );
  });

  it('should bail when SOME tools have results and SOME do not (mixed scenario)', async () => {
    // Arrange: One tool with execute, one without (the bug scenario)
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'updateTitle',
        args: { title: 'test' },
        result: { success: true }, // Has result (has execute function)
      },
      {
        toolCallId: 'call-2',
        toolName: 'updateSummary',
        args: { summary: 'test' },
        result: undefined, // No result (HITL, no execute function)
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should bail (suspend execution) because updateSummary needs HITL
    expect(bail).toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(false);
    // Should NOT emit tool-result chunks
    expect(controller.enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tool-result' }));
  });

  it('should emit tool-error for tools with errors when all results are undefined', async () => {
    // Arrange: Tools without results but with errors
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'brokenTool',
        args: { param: 'test' },
        result: undefined,
        error: new Error('Tool execution failed'),
      },
    ];

    // Act
    await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should emit tool-error chunk
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          error: expect.any(Error),
        }),
      }),
    );
    expect(bail).toHaveBeenCalled();
  });

  it('should continue the agentic loop (not bail) when all errors are tool-not-found', async () => {
    // Arrange: Tool call with ToolNotFoundError (set by tool-call-step when tool name is hallucinated)
    const { ToolNotFoundError } = await import('../errors');
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'creating:view',
        args: { param: 'test' },
        result: undefined,
        error: new ToolNotFoundError(
          'Tool "creating:view" not found. Available tools: view, list. Call tools by their exact name only.',
        ),
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should NOT bail — the agentic loop should continue so the model can self-correct
    expect(bail).not.toHaveBeenCalled();
    // Should still emit tool-error chunk so the error is visible in the stream
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          error: expect.any(Error),
        }),
      }),
    );
    // Should add the error message to the messageList so the model can see it
    expect(messageList.add).toHaveBeenCalled();
    // isContinued should be true to keep the loop going
    expect(result.stepResult.isContinued).toBe(true);
  });

  it('should emit successful tool results alongside tool-not-found errors in the same turn', async () => {
    // Arrange: One valid tool with result + one hallucinated tool-not-found error
    const { ToolNotFoundError } = await import('../errors');
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'existingTool',
        args: { param: 'test' },
        result: { success: true },
      },
      {
        toolCallId: 'call-2',
        toolName: 'creating:view',
        args: { param: 'test' },
        result: undefined,
        error: new ToolNotFoundError(
          'Tool "creating:view" not found. Available tools: existingTool. Call tools by their exact name only.',
        ),
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should NOT bail — this is a tool-not-found scenario
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);

    // Should emit tool-error for the hallucinated tool
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: 'call-2',
          toolName: 'creating:view',
        }),
      }),
    );

    // Should also emit tool-result for the successful tool
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'existingTool',
          result: { success: true },
        }),
      }),
    );

    // Should add both error and result messages to the messageList
    expect(messageList.add).toHaveBeenCalledTimes(2);
  });

  it('should bail when tool-not-found errors are mixed with pending HITL tools', async () => {
    // Arrange: One hallucinated tool (ToolNotFoundError) + one HITL tool (no result, no error)
    const { ToolNotFoundError } = await import('../errors');
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'creating:view',
        args: { param: 'test' },
        result: undefined,
        error: new ToolNotFoundError('Tool "creating:view" not found.'),
      },
      {
        toolCallId: 'call-2',
        toolName: 'updateSummary',
        args: { summary: 'test' },
        result: undefined, // No result (HITL, no execute function)
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should bail (suspend) because HITL tool needs human input,
    // even though the other error is a tool-not-found
    expect(bail).toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(false);
  });

  it('should bail when errors are a mix of tool-not-found and other errors', async () => {
    // Arrange: One tool-not-found error and one execution error
    const { ToolNotFoundError } = await import('../errors');
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'creating:view',
        args: { param: 'test' },
        result: undefined,
        error: new ToolNotFoundError('Tool "creating:view" not found.'),
      },
      {
        toolCallId: 'call-2',
        toolName: 'existingTool',
        args: { param: 'test' },
        result: undefined,
        error: new Error('Execution timeout'),
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should bail because not all errors are tool-not-found
    expect(bail).toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(false);
  });
});
