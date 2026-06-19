import type { ContentBlock } from '@agentclientprotocol/sdk';

import { describe, it, expect } from 'vitest';

import { extractTextFromContentBlocks, mapStopReason } from './agent.js';

describe('ACP Agent - Text Extraction', () => {
  it('extracts text from text blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'text', text: 'Hello, world!' }];

    expect(extractTextFromContentBlocks(blocks)).toBe('Hello, world!');
  });

  it('concatenates multiple text blocks with newlines', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Line 1' },
      { type: 'text', text: 'Line 2' },
      { type: 'text', text: 'Line 3' },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe('Line 1\nLine 2\nLine 3');
  });

  it('handles resource_link blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Check this file:' },
      { type: 'resource_link', uri: 'file:///path/to/file.ts', name: 'file.ts' },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe('Check this file:\n[resource: file:///path/to/file.ts]');
  });

  it('handles resource blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Here is the content:' },
      {
        type: 'resource',
        resource: {
          uri: 'file:///path/to/file.ts',
          mimeType: 'text/plain',
          text: 'file content',
        },
      },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe(
      'Here is the content:\n[resource: file:///path/to/file.ts]',
    );
  });

  it('handles mixed content blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Start' },
      { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' },
      { type: 'text', text: 'Middle' },
      {
        type: 'resource',
        resource: {
          uri: 'file:///b.ts',
          mimeType: 'text/plain',
          text: 'content',
        },
      },
      { type: 'text', text: 'End' },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe(
      'Start\n[resource: file:///a.ts]\nMiddle\n[resource: file:///b.ts]\nEnd',
    );
  });

  it('handles empty blocks array', () => {
    expect(extractTextFromContentBlocks([])).toBe('');
  });
});

describe('ACP Agent - StopReason Mapping', () => {
  it('maps complete to end_turn', () => {
    expect(mapStopReason('complete')).toBe('end_turn');
  });

  it('maps aborted to cancelled', () => {
    expect(mapStopReason('aborted')).toBe('cancelled');
  });

  it('maps error to end_turn', () => {
    expect(mapStopReason('error')).toBe('end_turn');
  });

  it('maps suspended to end_turn', () => {
    expect(mapStopReason('suspended')).toBe('end_turn');
  });
});
