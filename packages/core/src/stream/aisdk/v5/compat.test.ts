import { describe, it, expect } from 'vitest';
import { convertFullStreamChunkToUIMessageStream, isUrlString } from './compat';
import { DefaultGeneratedFileWithType } from './file';

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

  it('emits a data URI for base64-backed generated files', () => {
    const result = convertFullStreamChunkToUIMessageStream({
      part: {
        type: 'file',
        file: new DefaultGeneratedFileWithType({ data: 'aGVsbG8=', mediaType: 'text/plain' }),
      } as any,
      onError: error => `Error: ${error}`,
    });

    expect(result).toEqual({
      type: 'file',
      mediaType: 'text/plain',
      url: 'data:text/plain;base64,aGVsbG8=',
    });
  });

  it('emits the URL directly for URL-backed generated files instead of a broken data URI', () => {
    const result = convertFullStreamChunkToUIMessageStream({
      part: {
        type: 'file',
        file: new DefaultGeneratedFileWithType({
          data: 'https://example.com/generated.jpeg',
          mediaType: 'image/jpeg',
        }),
      } as any,
      onError: error => `Error: ${error}`,
    });

    expect(result).toEqual({
      type: 'file',
      mediaType: 'image/jpeg',
      url: 'https://example.com/generated.jpeg',
    });
  });
});

describe('isUrlString', () => {
  it('detects http(s) URL strings', () => {
    expect(isUrlString('https://example.com/generated.jpeg')).toBe(true);
    expect(isUrlString('http://example.com/file.png')).toBe(true);
  });

  it('rejects base64 content, data URIs, and other schemes', () => {
    expect(isUrlString('aGVsbG8=')).toBe(false);
    expect(isUrlString('iVBORw0KGgo=')).toBe(false);
    expect(isUrlString('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
    expect(isUrlString('foo:bar')).toBe(false);
    expect(isUrlString('')).toBe(false);
  });
});
