import { describe, it, expect } from 'vitest';
import { convertFullStreamChunkToUIMessageStream } from './compat';

describe('convertFullStreamChunkToUIMessageStream', () => {
  it('should convert tool-output part into UI message with correct format', () => {
    // Arrange: Create a tool-output part with sample data
    const toolOutput = {
      type: 'tool-output',
      toolCallId: 'test-tool-123',
      toolName: 'test-tool-a',
      output: {
        content: 'Sample tool output content',
        timestamp: 1234567890,
        metadata: {
          source: 'test',
          version: '1.0',
        },
        status: 'success',
      },
    } as const;

    // Act: Convert the tool output to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
      id: 'test-tool-123',
      content: 'Sample tool output content',
      timestamp: 1234567890,
      metadata: {
        source: 'test',
        version: '1.0',
      },
      status: 'success',
    });
  });

  it('should convert typed tool-output part into UI message with correct format', () => {
    // Arrange: Create a tool-output part with sample data
    const toolOutput = {
      type: 'tool-output',
      toolCallId: 'test-tool-123',
      toolName: 'test-tool-a',
      output: {
        type: 'tool-input-start',
        id: 'test-tool-456',
        toolName: 'test-tool-b',
      },
    } as const;

    // Act: Convert the tool output to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeDefined();
    expect(result).toEqual({
        type: 'tool-input-start',
        toolCallId: 'test-tool-456',
        toolName: 'test-tool-b',
    });
  });

  it('should not convert typed tool-output part into UI message if type does no begin with tool-', () => {
    // Arrange: Create a tool-output part with sample data
    const toolOutput = {
      type: 'tool-output',
      toolCallId: 'test-tool-123',
      toolName: 'test-tool-a',
      output: {
        from: 'AGENT',
        runId: '123456789',
        type: 'object',
        object: {},
      },
    } as const;

    // Act: Convert the tool output to UI message
    const result = convertFullStreamChunkToUIMessageStream({
      part: toolOutput,
      onError: error => `Error: ${error}`,
    });

    // Assert: Verify the transformation
    expect(result).toBeUndefined();
  });
});
