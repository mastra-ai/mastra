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

  it('should emit tool-error for tools with errors and continue the loop for self-recovery', async () => {
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

  it('should continue when provider-executed tools are mixed with regular tools', async () => {
    // Arrange: One regular tool with result + one provider-executed tool with fallback result
    // This is the scenario from #13125 — after the fix in tool-call-step, provider-executed
    // tools get a non-undefined result, so they should not trigger the bail path
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'get_company_info',
        args: { name: 'test' },
        result: { company: 'Acme' },
      },
      {
        toolCallId: 'call-2',
        toolName: 'web_search_20250305',
        args: { query: 'test' },
        result: { providerExecuted: true, toolName: 'web_search_20250305' },
        providerExecuted: true,
      },
    ];

    // Act
    await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should NOT bail — both tools have results
    expect(bail).not.toHaveBeenCalled();
    // Should emit tool-result for both tools
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          result: { company: 'Acme' },
        }),
      }),
    );
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-2',
          result: { providerExecuted: true, toolName: 'web_search_20250305' },
        }),
      }),
    );
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

describe('createLLMMappingStep tool execution error self-recovery (issue #9815)', () => {
  let controller: { enqueue: Mock };
  let messageList: MessageList;
  let llmExecutionStep: any;
  let bail: Mock;
  let getStepResult: Mock;
  let llmMappingStep: ReturnType<typeof createLLMMappingStep>;

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

  it('should continue the agentic loop when a tool throws an execution error, allowing the model to self-recover', async () => {
    // Issue #9815: When a tool execution fails (e.g., invalid args, runtime error),
    // the error should be returned to the model so it can self-correct,
    // NOT bail and terminate the agentic loop.
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'myTool',
        args: { invalidParam: 'wrong type' },
        result: undefined,
        error: new Error('Invalid arguments: expected "count" to be a number, got string'),
      },
    ];

    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // The error should be emitted as a tool-error chunk
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'myTool',
          error: expect.any(Error),
        }),
      }),
    );

    // The error should be added to messageList so the model can see it
    expect(messageList.add).toHaveBeenCalled();

    // CRITICAL: The loop should NOT bail — it should continue so the model can self-correct
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);
  });

  it('should continue the loop when a tool execution error occurs alongside successful tool results', async () => {
    // Mixed scenario: one tool succeeds, one throws at runtime.
    // The model should see both the success and the error, and be allowed to retry.
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'fetchData',
        args: { url: 'https://example.com' },
        result: { data: 'some content' },
      },
      {
        toolCallId: 'call-2',
        toolName: 'processData',
        args: { data: null },
        result: undefined,
        error: new Error('Cannot process null data'),
      },
    ];

    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Should emit tool-error for the failed tool
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: 'call-2',
          toolName: 'processData',
        }),
      }),
    );

    // Should also emit tool-result for the successful tool
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'fetchData',
          result: { data: 'some content' },
        }),
      }),
    );

    // Both error and success messages should be in messageList
    expect(messageList.add).toHaveBeenCalled();

    // Loop should continue for self-recovery
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);
  });

  it('should continue the loop when multiple tool execution errors occur in the same turn', async () => {
    // Multiple tools fail in the same turn. The model should see all errors and recover.
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'toolA',
        args: { x: 1 },
        result: undefined,
        error: new Error('Network timeout'),
      },
      {
        toolCallId: 'call-2',
        toolName: 'toolB',
        args: { y: 2 },
        result: undefined,
        error: new TypeError('Cannot read property "foo" of undefined'),
      },
    ];

    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Both errors should be emitted as tool-error chunks
    expect(controller.enqueue).toHaveBeenCalledTimes(2);

    // Errors should be added to messageList for the model to see
    expect(messageList.add).toHaveBeenCalled();

    // Loop should continue — model should see the errors and adapt
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);
  });

  it('should continue and persist provider-executed result when tool-not-found co-occurs with provider-executed tool', async () => {
    // Arrange: One hallucinated tool (ToolNotFoundError) + one provider-executed tool with result
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
        toolName: 'web_search_20250305',
        args: { query: 'test' },
        result: { providerExecuted: true, toolName: 'web_search_20250305' },
        providerExecuted: true,
      },
    ];

    // Act
    const result = await llmMappingStep.execute(createExecuteParams(inputData));

    // Assert: Should NOT bail — tool-not-found should self-correct
    expect(bail).not.toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(true);

    // Should persist the provider-executed result as a separate message
    const addCalls = (messageList.add as ReturnType<typeof vi.fn>).mock.calls;
    const providerMessage = addCalls.find(([msg]: [any]) =>
      msg.content?.parts?.some(
        (p: any) =>
          p.providerExecuted &&
          p.toolInvocation?.toolName === 'web_search_20250305' &&
          p.toolInvocation?.state === 'result',
      ),
    );
    expect(providerMessage).toBeDefined();
  });
});

describe('createLLMMappingStep provider-executed tool message filtering', () => {
  let controller: { enqueue: ReturnType<typeof vi.fn> };
  let messageList: MessageList;
  let llmExecutionStep: any;
  let bail: ReturnType<typeof vi.fn>;
  let getStepResult: ReturnType<typeof vi.fn>;
  let llmMappingStep: ReturnType<typeof createLLMMappingStep>;

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

  it('should split client-executed and provider-executed tools into separate messageList entries', async () => {
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'get_company_info',
        args: { name: 'test' },
        result: { company: 'Acme' },
      },
      {
        toolCallId: 'call-2',
        toolName: 'web_search_20250305',
        args: { query: 'test' },
        result: { providerExecuted: true, toolName: 'web_search_20250305' },
        providerExecuted: true,
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    expect(messageList.add).toHaveBeenCalledTimes(2);

    const addCalls = (messageList.add as ReturnType<typeof vi.fn>).mock.calls;

    // First call: client-executed tools only
    const clientMsg = addCalls[0][0];
    const clientToolNames = clientMsg.content.parts.map((p: any) => p.toolInvocation.toolName);
    expect(clientToolNames).toContain('get_company_info');
    expect(clientToolNames).not.toContain('web_search_20250305');

    // Second call: provider-executed tools with providerExecuted flag
    const providerMsg = addCalls[1][0];
    const providerParts = providerMsg.content.parts;
    expect(providerParts).toHaveLength(1);
    expect(providerParts[0].toolInvocation.toolName).toBe('web_search_20250305');
    expect(providerParts[0].toolInvocation.state).toBe('result');
    expect(providerParts[0].providerExecuted).toBe(true);
  });

  it('should add a provider-executed tool-result message to messageList to update state from call to result', async () => {
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'web_search_20250305',
        args: { query: 'test' },
        result: { providerExecuted: true, toolName: 'web_search_20250305' },
        providerExecuted: true,
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    expect(messageList.add).toHaveBeenCalledTimes(1);

    const addCall = (messageList.add as ReturnType<typeof vi.fn>).mock.calls[0];
    const msg = addCall[0];
    expect(msg.content.parts).toHaveLength(1);
    expect(msg.content.parts[0].toolInvocation.state).toBe('result');
    expect(msg.content.parts[0].toolInvocation.toolName).toBe('web_search_20250305');
    expect(msg.content.parts[0].providerExecuted).toBe(true);
  });

  it('should emit stream chunks for provider-executed tools even though they are excluded from the client tool-result message', async () => {
    const inputData: ToolCallOutput[] = [
      {
        toolCallId: 'call-1',
        toolName: 'get_company_info',
        args: { name: 'test' },
        result: { company: 'Acme' },
      },
      {
        toolCallId: 'call-2',
        toolName: 'web_search_20250305',
        args: { query: 'test' },
        result: { providerExecuted: true, toolName: 'web_search_20250305' },
        providerExecuted: true,
      },
    ];

    await llmMappingStep.execute(createExecuteParams(inputData));

    // Stream chunks should be emitted for BOTH tools
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({ toolCallId: 'call-1' }),
      }),
    );
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({ toolCallId: 'call-2' }),
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
