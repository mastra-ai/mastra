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
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

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
    // Should NOT bail — the agentic loop should continue so the model can see the error and retry
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);
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

  it('should continue the loop when errors are a mix of tool-not-found and other errors', async () => {
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

    // Assert: Should NOT bail — error messages are in the messageList,
    // the model can see them and self-correct or retry
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);
  });
});

describe('createLLMMappingStep onChunk', () => {
  let controller: { enqueue: Mock };
  let messageList: MessageList;
  let llmExecutionStep: any;
  let bail: Mock;
  let getStepResult: Mock;
  let onChunk: Mock;

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
    controller = { enqueue: vi.fn() };
    onChunk = vi.fn();

    messageList = {
      get: {
        all: { aiV5: { model: () => [] } },
        input: { aiV5: { model: () => [] } },
        response: { aiV5: { model: () => [] } },
      },
      add: vi.fn(),
    } as unknown as MessageList;

    llmExecutionStep = createStep({
      id: 'test-llm-execution',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({
        stepResult: { isContinued: true, reason: undefined },
        metadata: {},
      }),
    });

    bail = vi.fn(data => data);
    getStepResult = vi.fn(() => ({
      stepResult: { isContinued: true, reason: undefined },
      metadata: {},
    }));
  });

  it('should call onChunk with raw Mastra chunks for successful tool results', async () => {
    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        options: { onChunk },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'myTool',
        args: { input: 'test' },
        result: { success: true },
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'myTool',
          result: { success: true },
        }),
      }),
    );
  });

  it('should call onChunk for tool-error chunks', async () => {
    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        options: { onChunk },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'brokenTool',
        args: { param: 'test' },
        result: undefined,
        error: new Error('Tool execution failed'),
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'brokenTool',
          error: expect.any(Error),
        }),
      }),
    );
  });

  it('should call onChunk for both tool-error and tool-result chunks in mixed-error scenarios', async () => {
    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        options: { onChunk },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'existingTool',
        args: { param: 'test' },
        result: { success: true },
      },
      {
        toolCallId: 'call-2',
        toolName: 'brokenTool',
        args: { param: 'test' },
        result: undefined,
        error: new Error('Tool failed'),
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // Should have called onChunk for both the error and the success
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({ toolCallId: 'call-2' }),
      }),
    );
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({ toolCallId: 'call-1' }),
      }),
    );
  });

  it('should not call onChunk for blocked chunks (tripwire)', async () => {
    // processOutputStream calls abort() to trigger a TripWire, which blocks the chunk
    const blockingProcessor = {
      id: 'blocker',
      name: 'blocker',
      processOutputStream: vi.fn().mockImplementation(({ abort }: any) => {
        abort('Content blocked by policy');
      }),
    };

    const processorStates = new Map();

    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        options: { onChunk },
        outputProcessors: [blockingProcessor],
        processorStates,
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'myTool',
        args: { input: 'test' },
        result: { success: true },
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // onChunk should NOT be called because the chunk was blocked
    expect(onChunk).not.toHaveBeenCalled();
    // But a tripwire chunk should have been enqueued
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tripwire',
      }),
    );
  });

  it('should pass processed chunk to onChunk when output processor modifies it', async () => {
    // processOutputStream returns the modified chunk directly
    const modifyingProcessor = {
      id: 'modifier',
      name: 'modifier',
      processOutputStream: vi.fn().mockImplementation(({ part }: any) => {
        return {
          ...part,
          payload: { ...part.payload, modified: true },
        };
      }),
    };

    const processorStates = new Map();

    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        options: { onChunk },
        outputProcessors: [modifyingProcessor],
        processorStates,
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'myTool',
        args: { input: 'test' },
        result: { success: true },
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // onChunk should receive the MODIFIED chunk, not the original
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          modified: true,
          toolCallId: 'call-1',
        }),
      }),
    );
  });
});

describe('createLLMMappingStep toModelOutput', () => {
  let controller: { enqueue: Mock };
  let messageList: MessageList;
  let llmExecutionStep: any;
  let bail: Mock;
  let getStepResult: Mock;

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
    controller = { enqueue: vi.fn() };

    messageList = {
      get: {
        all: { aiV5: { model: () => [] } },
        input: { aiV5: { model: () => [] } },
        response: { aiV5: { model: () => [] } },
      },
      add: vi.fn(),
    } as unknown as MessageList;

    llmExecutionStep = createStep({
      id: 'test-llm-execution',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({
        stepResult: { isContinued: true, reason: undefined },
        metadata: {},
      }),
    });

    bail = vi.fn(data => data);
    getStepResult = vi.fn(() => ({
      stepResult: { isContinued: true, reason: undefined },
      metadata: {},
    }));
  });

  it('should call toModelOutput and store result on providerMetadata.mastra.modelOutput', async () => {
    const toModelOutputMock = vi.fn((output: unknown) => ({
      type: 'text',
      value: `Transformed: ${JSON.stringify(output)}`,
    }));

    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        tools: {
          weather: {
            execute: async () => ({ temperature: 72 }),
            toModelOutput: toModelOutputMock,
            inputSchema: z.object({ city: z.string() }),
          },
        },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'weather',
        args: { city: 'NYC' },
        result: { temperature: 72, conditions: 'sunny' },
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // toModelOutput should have been called with the raw result
    expect(toModelOutputMock).toHaveBeenCalledWith({ temperature: 72, conditions: 'sunny' });

    // The message added to messageList should have providerMetadata.mastra.modelOutput
    expect(messageList.add).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: 'tool-invocation',
              toolInvocation: expect.objectContaining({
                toolCallId: 'call-1',
                result: { temperature: 72, conditions: 'sunny' }, // raw result preserved
              }),
              providerMetadata: expect.objectContaining({
                mastra: expect.objectContaining({
                  modelOutput: {
                    type: 'text',
                    value: 'Transformed: {"temperature":72,"conditions":"sunny"}',
                  },
                }),
              }),
            }),
          ]),
        }),
      }),
      'response',
    );
  });

  it('should NOT call toModelOutput for tools without it defined', async () => {
    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        tools: {
          plainTool: {
            execute: async () => ({ done: true }),
            inputSchema: z.object({ input: z.string() }),
          },
        },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'plainTool',
        args: { input: 'test' },
        result: { done: true },
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // Message should NOT have providerMetadata on the part
    expect(messageList.add).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: 'tool-invocation',
              toolInvocation: expect.objectContaining({
                toolCallId: 'call-1',
                result: { done: true },
              }),
            }),
          ]),
        }),
      }),
      'response',
    );

    // providerMetadata should not be set on the part
    const addedMessage = (messageList.add as Mock).mock.calls[0]![0];
    const part = addedMessage.content.parts[0];
    expect(part.providerMetadata).toBeUndefined();
  });

  it('should call toModelOutput for mixed tools (only the ones that define it)', async () => {
    const toModelOutputMock = vi.fn((_output: unknown) => ({
      type: 'text',
      value: 'transformed',
    }));

    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        tools: {
          withTransform: {
            execute: async () => ({ data: 'raw' }),
            toModelOutput: toModelOutputMock,
            inputSchema: z.object({}),
          },
          withoutTransform: {
            execute: async () => ({ data: 'raw' }),
            inputSchema: z.object({}),
          },
        },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'withTransform',
        args: {},
        result: { data: 'raw' },
      },
      {
        toolCallId: 'call-2',
        toolName: 'withoutTransform',
        args: {},
        result: { data: 'raw' },
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    expect(toModelOutputMock).toHaveBeenCalledTimes(1);
    expect(toModelOutputMock).toHaveBeenCalledWith({ data: 'raw' });

    const addedMessage = (messageList.add as Mock).mock.calls[0]![0];
    const parts = addedMessage.content.parts;

    // First tool should have modelOutput
    expect(parts[0].providerMetadata?.mastra?.modelOutput).toEqual({
      type: 'text',
      value: 'transformed',
    });

    // Second tool should NOT have providerMetadata
    expect(parts[1].providerMetadata).toBeUndefined();
  });

  it('should NOT call toModelOutput when tool result is null/undefined', async () => {
    const toModelOutputMock = vi.fn();

    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
        tools: {
          hitlTool: {
            toModelOutput: toModelOutputMock,
            inputSchema: z.object({}),
          },
        },
      } as any,
      llmExecutionStep,
    );

    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'hitlTool',
        args: {},
        result: undefined, // HITL — no result yet
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // toModelOutput should NOT be called for undefined results
    expect(toModelOutputMock).not.toHaveBeenCalled();
  });
});
