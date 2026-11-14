import { setFlagsFromString } from 'node:v8';

import type { MastraDBMessage } from '@mastra/core/agent';
import { beforeAll, describe, expect, it } from 'vitest';

import { TokenCounter } from '../token-counter';

// A long-running process can end up running unoptimized regex code (seen in a multi-day
// Mastra Code session). Unoptimized regex code runs out of backtracking stack on
// multi-megabyte inputs. Forcing that mode here reproduces it deterministically.
beforeAll(() => {
  setFlagsFromString('--no-regexp-optimization');
});

function pngBase64(width: number, height: number, totalBytes: number): string {
  const bytes = Buffer.alloc(Math.max(totalBytes, 33));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes.toString('base64');
}

// Same shape as a workspace `view` tool result for a screenshot.
function viewToolResultMessage(data: string): MastraDBMessage {
  const text = 'Viewed image /tmp/screenshot.png';
  return {
    id: 'msg-view',
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'tool-1',
            toolName: 'view',
            args: { path: '/tmp/screenshot.png' },
            result: { __workspaceMedia: true, text, mediaType: 'image/png', data },
          },
          providerMetadata: {
            mastra: {
              modelOutput: {
                type: 'content',
                value: [
                  { type: 'text', text },
                  { type: 'media', data, mediaType: 'image/png' },
                ],
              },
            },
          },
        },
      ],
    },
  } as unknown as MastraDBMessage;
}

describe('TokenCounter with multi-megabyte base64 images', () => {
  it('counts a screenshot-sized view result by its image dimensions', async () => {
    // 3,153,365 bytes is the size of the screenshot whose base64 (4,204,488 chars) broke
    // observation in the reported session.
    const large = viewToolResultMessage(pngBase64(3024, 1964, 3_153_365));
    const small = viewToolResultMessage(pngBase64(3024, 1964, 64));

    const largeTokens = await new TokenCounter().countMessageAsync(large);
    const smallTokens = await new TokenCounter().countMessageAsync(small);

    expect(largeTokens).toBe(smallTokens);
    expect(new TokenCounter().countMessage(large)).toBe(new TokenCounter().countMessage(small));
  });
});
