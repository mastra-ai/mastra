import { describe, it, expect } from 'vitest';
import { ChunkFrom } from '../../types';
import { convertFullStreamChunkToUIMessageStream } from './compat';
import { convertMastraChunkToAISDKv5 } from './transform';

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
      content: 'Sample tool output content',
      timestamp: 1234567890,
      metadata: {
        source: 'test',
        version: '1.0',
      },
      status: 'success',
    });
  });

  it('converts denied tool results into a denied UI chunk', () => {
    const part = convertMastraChunkToAISDKv5({
      chunk: {
        type: 'tool-result',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'denied-tool-123',
          toolName: 'dangerousTool',
          args: {},
          result: 'Tool call was not approved by the user',
          denied: true,
          deniedReason: 'User declined approval',
        },
      },
    });

    const result = convertFullStreamChunkToUIMessageStream({
      part: part as any,
      onError: error => `Error: ${error}`,
    });

    expect(result).toEqual({
      type: 'tool-output-denied',
      toolCallId: 'denied-tool-123',
      reason: 'User declined approval',
    });
  });

  it('converts generic tool errors into error UI chunks', () => {
    const result = convertFullStreamChunkToUIMessageStream({
      part: {
        type: 'tool-error',
        toolCallId: 'failed-tool-123',
        toolName: 'failingTool',
        error: new Error('boom'),
      } as any,
      onError: error => (error instanceof Error ? error.message : String(error)),
    });

    expect(result).toEqual({
      type: 'tool-output-error',
      toolCallId: 'failed-tool-123',
      errorText: 'boom',
    });
  });
});
