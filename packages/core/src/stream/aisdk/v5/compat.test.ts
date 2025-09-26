import { describe, it, expect } from 'vitest';
import { convertFullStreamChunkToUIMessageStream } from './compat';

describe('convertFullStreamChunkToUIMessageStream', () => {
  it('should convert tool-output part into UI message with correct format', () => {
    // Arrange: Create a tool-output part with sample data
    const toolOutput = {
      type: 'tool-output' as const,
      toolCallId: 'test-tool-123',
      output: {
        content: 'Sample tool output content',
        timestamp: 1234567890,
        metadata: {
          source: 'test',
          version: '1.0',
        },
        status: 'success',
      },
    };

    // Act: Convert the tool output to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
      toolCallId: 'test-tool-123',
      content: 'Sample tool output content',
      timestamp: 1234567890,
      metadata: {
        source: 'test',
        version: '1.0',
      },
      status: 'success',
    });
  });

  it('should convert tool output part containing workflow-start payload into UI message with correct format', () => {
    // Arrange: Create a workflow-start part with sample data
    const toolOutput = {
      type: 'tool-output',
      output: {
        type: 'workflow-start',
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {},
      },
      toolCallId: 'call_vds1lY3t5KNXUTRCX8wtn4uR',
      toolName: 'test-workflow',
    };

    // Act: Convert the workflow start to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
      type: 'data-workflow-start',
      data: {
        id: 'call_vds1lY3t5KNXUTRCX8wtn4uR',
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {},
      },
    });
  });

  it('should convert tool output part containing workflow-step-start payload into UI message with correct format', () => {
    // Arrange: Create a workflow-step-start part with sample data
    const toolOutput = {
      type: 'tool-output',
      output: {
        type: 'workflow-step-start',
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {
          stepName: 'mapping_mock-uuid-1',
          id: 'mapping_mock-uuid-1',
          stepCallId: 'abcxyz123',
          payload: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
          startedAt: new Date('2025-09-26T00:00:00Z'),
          status: 'running',
        },
      },
    };

    // Act: Convert the workflow step start to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
      type: 'data-workflow-step-start',
      data: {
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {
          stepName: 'mapping_mock-uuid-1',
          id: 'mapping_mock-uuid-1',
          stepCallId: 'abcxyz123',
          payload: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
          startedAt: new Date('2025-09-26T00:00:00Z'),
          status: 'running',
        },
      },
    });
  });

  it('should convert tool output part containing workflow-step-result payload into UI message with correct format', () => {
    // Arrange: Create a workflow-step-result part with sample data
    const toolOutput = {
      type: 'tool-output',
      output: {
        type: 'workflow-step-result',
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {
          stepName: 'start',
          id: 'start',
          stepCallId: 'abcxyz123',
          status: 'success',
          output: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
          endedAt: new Date('2025-09-26T00:00:00Z'),
        },
      },
    };

    // Act: Convert the workflow step result to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
      type: 'data-workflow-step-result',
      data: {
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {
          stepName: 'start',
          id: 'start',
          stepCallId: 'abcxyz123',
          status: 'success',
          output: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
          endedAt: new Date('2025-09-26T00:00:00Z'),
        },
      },
    });
  });

  it('should convert tool output part containing workflow-finish payload into UI message with correct format', () => {
    // Arrange: Create a workflow-finish part with sample data
    const toolOutput = {
      type: 'tool-output',
      output: {
        type: 'workflow-finish',
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {
          output: {
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
          },
          metadata: {},
        },
      },
      toolCallId: 'call_vds1lY3t5KNXUTRCX8wtn4uR',
      toolName: 'test-workflow',
    };

    // Act: Convert the workflow finish to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
      type: 'data-workflow-finish',
      data: {
        id: 'call_vds1lY3t5KNXUTRCX8wtn4uR',
        runId: 'test-run-id',
        from: 'WORKFLOW',
        payload: {
          output: {
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
          },
          metadata: {},
        },
      },
    });
  });
});
