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
    // Should NOT bail - allow the loop to continue so LLM can see the error and retry
    expect(bail).not.toHaveBeenCalled();
  });
});
