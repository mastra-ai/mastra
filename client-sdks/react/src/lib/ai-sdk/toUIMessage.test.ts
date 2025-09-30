import { describe, it, expect } from 'vitest';
import { toUIMessage, type MastraUIMessage } from './toUIMessage';
import { ChunkType, ChunkFrom } from '@mastra/core/stream';

describe('toUIMessage', () => {
  it('should handle start chunk by creating new assistant message', () => {
    const chunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const conversation: MastraUIMessage[] = [];
    const result = toUIMessage({ chunk, conversation });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'run-123',
      role: 'assistant',
      parts: [],
    });
    expect(result).not.toBe(conversation); // Different reference
  });

  it('should handle text-start by adding empty text part', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const textStartChunk: ChunkType = {
      type: 'text-start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'text-1',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: textStartChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'text',
      text: '',
      state: 'streaming',
      providerMetadata: { test: 'metadata' },
    });
  });

  it('should handle text-delta by appending to existing text part', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const textDelta1: ChunkType = {
      type: 'text-delta',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'text-1',
        text: 'Hello',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    const textDelta2: ChunkType = {
      type: 'text-delta',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'text-1',
        text: ' world',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: textDelta1, conversation });
    conversation = toUIMessage({ chunk: textDelta2, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'text',
      text: 'Hello world',
      state: 'streaming',
      providerMetadata: { test: 'metadata' },
    });
  });

  it('should handle reasoning-delta by creating and updating reasoning part', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const reasoningDelta1: ChunkType = {
      type: 'reasoning-delta',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'reason-1',
        text: 'Let me think...',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    const reasoningDelta2: ChunkType = {
      type: 'reasoning-delta',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'reason-1',
        text: ' about this problem.',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: reasoningDelta1, conversation });
    conversation = toUIMessage({ chunk: reasoningDelta2, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'reasoning',
      text: 'Let me think... about this problem.',
      state: 'streaming',
      providerMetadata: { test: 'metadata' },
    });
  });

  it('should handle tool-call by creating dynamic-tool part', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const toolCallChunk: ChunkType = {
      type: 'tool-call',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        toolName: 'calculator',
        args: { x: 5, y: 3, operation: 'add' } as any,
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: toolCallChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'dynamic-tool',
      toolName: 'calculator',
      toolCallId: 'tool-call-123',
      state: 'input-available',
      input: { x: 5, y: 3, operation: 'add' },
      callProviderMetadata: { test: 'metadata' },
    });
  });

  it('should handle tool-result by updating corresponding tool part', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const toolCallChunk: ChunkType = {
      type: 'tool-call',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        toolName: 'calculator',
        args: { x: 5, y: 3, operation: 'add' } as any,
      },
    };

    const toolOutputChunk: ChunkType = {
      type: 'tool-output',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        output: { intermediate: 'data' },
      },
    };

    const toolResultChunk: ChunkType = {
      type: 'tool-result',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        toolName: 'calculator',
        result: 8,
        isError: false,
        providerMetadata: { test: 'result-metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: toolCallChunk, conversation });
    conversation = toUIMessage({ chunk: toolOutputChunk, conversation });
    conversation = toUIMessage({ chunk: toolResultChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    const toolPart = conversation[0].parts[0];
    expect(toolPart).toEqual({
      type: 'dynamic-tool',
      toolName: 'calculator',
      toolCallId: 'tool-call-123',
      state: 'output-available',
      input: { x: 5, y: 3, operation: 'add' },
      output: [{ intermediate: 'data' }],
      callProviderMetadata: { test: 'result-metadata' },
    });
  });

  it('should handle tool-result with error', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const toolCallChunk: ChunkType = {
      type: 'tool-call',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        toolName: 'calculator',
        args: { x: 5, y: 0, operation: 'divide' } as any,
      },
    };

    const toolResultChunk: ChunkType = {
      type: 'tool-result',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        toolName: 'calculator',
        result: 'Division by zero error',
        isError: true,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: toolCallChunk, conversation });
    conversation = toUIMessage({ chunk: toolResultChunk, conversation });

    expect(conversation).toHaveLength(1);
    const toolPart = conversation[0].parts[0];
    expect(toolPart).toEqual({
      type: 'dynamic-tool',
      toolName: 'calculator',
      toolCallId: 'tool-call-123',
      state: 'output-error',
      input: { x: 5, y: 0, operation: 'divide' },
      errorText: 'Division by zero error',
      callProviderMetadata: undefined,
    });
  });

  it('should handle tool-output by storing output in output field', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const toolCallChunk: ChunkType = {
      type: 'tool-call',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        toolName: 'workflow',
        args: { task: 'process' } as any,
      },
    };

    const toolOutputChunk: ChunkType = {
      type: 'tool-output',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tool-call-123',
        output: { step: 1, status: 'complete' },
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: toolCallChunk, conversation });
    conversation = toUIMessage({ chunk: toolOutputChunk, conversation });

    expect(conversation).toHaveLength(1);
    const toolPart = conversation[0].parts[0];
    expect(toolPart).toEqual({
      type: 'dynamic-tool',
      toolName: 'workflow',
      toolCallId: 'tool-call-123',
      state: 'input-available',
      input: { task: 'process' },
      output: [{ step: 1, status: 'complete' }],
      callProviderMetadata: undefined,
    });
  });

  it('should handle source chunk with URL source', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const sourceChunk: ChunkType = {
      type: 'source',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'source-1',
        sourceType: 'url',
        title: 'Example Website',
        url: 'https://example.com',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: sourceChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'source-url',
      sourceId: 'source-1',
      url: 'https://example.com',
      title: 'Example Website',
      providerMetadata: { test: 'metadata' },
    });
  });

  it('should handle source chunk with document source', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const sourceChunk: ChunkType = {
      type: 'source',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'source-2',
        sourceType: 'document',
        title: 'Document Title',
        mimeType: 'application/pdf',
        filename: 'document.pdf',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: sourceChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'source-document',
      sourceId: 'source-2',
      mediaType: 'application/pdf',
      title: 'Document Title',
      filename: 'document.pdf',
      providerMetadata: { test: 'metadata' },
    });
  });

  it('should handle file chunk with string data', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const fileChunk: ChunkType = {
      type: 'file',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        data: 'Hello, World!',
        mimeType: 'text/plain',
        providerMetadata: { test: 'metadata' } as any,
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: fileChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'file',
      mediaType: 'text/plain',
      url: 'data:text/plain,Hello%2C%20World!',
      providerMetadata: { test: 'metadata' },
    });
  });

  it('should handle file chunk with base64 data', () => {
    const startChunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const fileChunk: ChunkType = {
      type: 'file',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        data: 'SGVsbG8sIFdvcmxkIQ==',
        base64: 'SGVsbG8sIFdvcmxkIQ==',
        mimeType: 'text/plain',
      },
    };

    let conversation: MastraUIMessage[] = [];
    conversation = toUIMessage({ chunk: startChunk, conversation });
    conversation = toUIMessage({ chunk: fileChunk, conversation });

    expect(conversation).toHaveLength(1);
    expect(conversation[0].parts).toHaveLength(1);
    expect(conversation[0].parts[0]).toEqual({
      type: 'file',
      mediaType: 'text/plain',
      url: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      providerMetadata: undefined,
    });
  });

  it('should handle finish chunk by marking parts as done', () => {
    let conversation: MastraUIMessage[] = [];

    // Create message with streaming text and reasoning
    conversation = toUIMessage({
      chunk: { type: 'start', runId: 'run-123', from: ChunkFrom.AGENT, payload: {} },
      conversation,
    });

    conversation = toUIMessage({
      chunk: {
        type: 'text-delta',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: { id: 'text-1', text: 'Hello' },
      },
      conversation,
    });

    conversation = toUIMessage({
      chunk: {
        type: 'reasoning-delta',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: { id: 'reason-1', text: 'Thinking...' },
      },
      conversation,
    });

    // Verify parts are streaming
    expect(conversation[0].parts[0]).toEqual({
      type: 'text',
      text: 'Hello',
      state: 'streaming',
      providerMetadata: undefined,
    });
    expect(conversation[0].parts[1]).toEqual({
      type: 'reasoning',
      text: 'Thinking...',
      state: 'streaming',
      providerMetadata: undefined,
    });

    // Apply finish chunk
    const finishChunk: ChunkType = {
      type: 'finish',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        metadata: {},
        messages: { all: [], user: [], nonUser: [] },
      },
    };

    conversation = toUIMessage({ chunk: finishChunk, conversation });

    // Verify parts are marked as done
    expect(conversation[0].parts[0]).toEqual({
      type: 'text',
      text: 'Hello',
      state: 'done',
      providerMetadata: undefined,
    });
    expect(conversation[0].parts[1]).toEqual({
      type: 'reasoning',
      text: 'Thinking...',
      state: 'done',
      providerMetadata: undefined,
    });
  });

  it('should handle error chunk by returning conversation unchanged', () => {
    const initialConversation: MastraUIMessage[] = [
      { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
    ];

    const errorChunk: ChunkType = {
      type: 'error',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: { error: 'Something went wrong' },
    };

    const result = toUIMessage({ chunk: errorChunk, conversation: initialConversation });

    expect(result).toEqual(initialConversation);
    expect(result).not.toBe(initialConversation); // Different reference
  });

  it('should handle unknown chunk types by returning conversation unchanged', () => {
    const initialConversation: MastraUIMessage[] = [
      { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
    ];

    const unknownChunk = {
      type: 'unknown-chunk-type',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: { data: 'test' },
    } as any;

    const result = toUIMessage({ chunk: unknownChunk, conversation: initialConversation });

    expect(result).toEqual(initialConversation);
    expect(result).not.toBe(initialConversation); // Different reference
  });

  it('should always return a new array reference for React', () => {
    const initialConversation: MastraUIMessage[] = [];

    const chunk: ChunkType = {
      type: 'start',
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {},
    };

    const result = toUIMessage({ chunk, conversation: initialConversation });

    expect(result).not.toBe(initialConversation);
  });

  it('should handle multiple tool outputs for the same tool call', () => {
    let conversation: MastraUIMessage[] = [];

    // Start message and tool call
    conversation = toUIMessage({
      chunk: { type: 'start', runId: 'run-123', from: ChunkFrom.AGENT, payload: {} },
      conversation,
    });

    conversation = toUIMessage({
      chunk: {
        type: 'tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tool-call-123',
          toolName: 'workflow',
          args: { task: 'multi-step' } as any,
        },
      },
      conversation,
    });

    // First tool output
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tool-call-123',
          output: { step: 1, status: 'complete' },
        },
      },
      conversation,
    });

    // Second tool output
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tool-call-123',
          output: { step: 2, status: 'complete' },
        },
      },
      conversation,
    });

    const toolPart = conversation[0].parts[0];
    expect(toolPart).toEqual({
      type: 'dynamic-tool',
      toolName: 'workflow',
      toolCallId: 'tool-call-123',
      state: 'input-available',
      input: { task: 'multi-step' },
      output: [
        { step: 1, status: 'complete' },
        { step: 2, status: 'complete' },
      ],
      callProviderMetadata: undefined,
    });
  });

  it('should handle workflow-related tool output chunks with accumulation', () => {
    let conversation: MastraUIMessage[] = [];

    // Start message and workflow tool call
    conversation = toUIMessage({
      chunk: { type: 'start', runId: 'run-123', from: ChunkFrom.AGENT, payload: {} },
      conversation,
    });

    conversation = toUIMessage({
      chunk: {
        type: 'tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          toolName: 'workflow-executor',
          args: { workflowId: 'wf-456', input: 'test data' } as any,
        },
      },
      conversation,
    });

    // First workflow chunk - workflow start
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          output: {
            type: 'workflow-start',
            runId: 'wf-run-789',
            payload: { workflowId: 'wf-456' },
          },
        },
      },
      conversation,
    });

    // Second workflow chunk - step start
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          output: {
            type: 'workflow-step-start',
            payload: { id: 'step-1', name: 'process-data', status: 'running' },
          },
        },
      },
      conversation,
    });

    // Third workflow chunk - step result
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          output: {
            type: 'workflow-step-result',
            payload: { id: 'step-1', status: 'success', output: 'processed data' },
          },
        },
      },
      conversation,
    });

    const toolPart = conversation[0].parts[0] as any;
    expect(toolPart.type).toBe('dynamic-tool');
    expect(toolPart.toolName).toBe('workflow-executor');
    expect(toolPart.toolCallId).toBe('workflow-call-123');
    expect(toolPart.input).toEqual({ workflowId: 'wf-456', input: 'test data' });

    // Check that output contains workflowFullState with accumulated workflow state
    const output = (toolPart as any).output;
    expect(output).toBeDefined();

    expect(output.runId).toBe('wf-run-789');
    expect(output.payload.workflowState.steps['step-1']).toEqual({
      id: 'step-1',
      name: 'process-data',
      status: 'success',
      output: 'processed data',
    });
  });

  it('should handle workflow finish chunk', () => {
    let conversation: MastraUIMessage[] = [];

    // Setup workflow tool call
    conversation = toUIMessage({
      chunk: { type: 'start', runId: 'run-123', from: ChunkFrom.AGENT, payload: {} },
      conversation,
    });

    conversation = toUIMessage({
      chunk: {
        type: 'tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          toolName: 'workflow-executor',
          args: { workflowId: 'wf-456' } as any,
        },
      },
      conversation,
    });

    // Start workflow
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          output: {
            type: 'workflow-start',
            runId: 'wf-run-789',
            payload: { workflowId: 'wf-456' },
          },
        },
      },
      conversation,
    });

    // Finish workflow
    conversation = toUIMessage({
      chunk: {
        type: 'tool-output',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'workflow-call-123',
          output: {
            type: 'workflow-finish',
            payload: { workflowStatus: 'success' },
          },
        },
      },
      conversation,
    });

    const toolPart = conversation[0].parts[0] as any;
    const output = toolPart.output;
    expect(output.payload.workflowState.status).toBe('success');
    expect(output.payload.currentStep).toBeUndefined();
  });
});
