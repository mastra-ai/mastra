import type { UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
import { describe, expect, it } from 'vitest';
import { aiV4UIMessagesToAIV4CoreMessages } from './output-converter';

const FILE_ID = 'file-XkZkAbCdEfGh123456';

/**
 * Provider file IDs (e.g. OpenAI Files API "file-...") stored as
 * experimental_attachments must be stripped before AI SDK v4's
 * convertToCoreMessages (whose internal attachmentsToParts throws
 * `Invalid URL` on non-URL strings) and re-appended as file parts on the
 * matching user core message. These tests target the strip/re-append
 * index mapping in aiV4UIMessagesToAIV4CoreMessages.
 */
describe('aiV4UIMessagesToAIV4CoreMessages provider file IDs', () => {
  it('keeps URL and data URI attachments in place while re-appending the file ID as a file part', () => {
    const messages: UIMessageV4[] = [
      {
        id: '1',
        role: 'user',
        content: 'look at these',
        parts: [{ type: 'text', text: 'look at these' }],
        experimental_attachments: [
          { url: FILE_ID, contentType: 'application/pdf' },
          { url: 'https://example.com/doc.pdf', contentType: 'application/pdf' },
          { url: 'data:image/png;base64,aGVsbG8=', contentType: 'image/png' },
        ],
      },
    ];
    const core = aiV4UIMessagesToAIV4CoreMessages(messages);
    expect(core).toHaveLength(1);
    const content = core[0]!.content as any[];
    const types = content.map(p => p.type);
    expect(types.filter(t => t === 'file').length + types.filter(t => t === 'image').length).toBe(3);
    const filePart = content.find(p => p.type === 'file' && p.data === FILE_ID);
    expect(filePart).toBeDefined();
    expect(filePart.mimeType).toBe('application/pdf');
    // the real URL attachment must survive too
    expect(JSON.stringify(content)).toContain('example.com/doc.pdf');
  });

  it('maps file IDs to the right user core message when assistant tool invocations split into extra core messages', () => {
    const messages: UIMessageV4[] = [
      {
        id: '1',
        role: 'user',
        content: 'first user msg, no attachments',
        parts: [{ type: 'text', text: 'first user msg, no attachments' }],
      },
      {
        id: '2',
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'search',
              args: { q: 'x' },
              result: { ok: true },
            },
          },
          { type: 'text', text: 'done' },
        ],
      },
      {
        id: '3',
        role: 'user',
        content: 'second user msg with file',
        parts: [{ type: 'text', text: 'second user msg with file' }],
        experimental_attachments: [{ url: FILE_ID, contentType: 'application/pdf' }],
      },
    ];
    const core = aiV4UIMessagesToAIV4CoreMessages(messages);
    // assistant with tool result splits into assistant + tool core messages
    const userMessages = core.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(2);
    const first = userMessages[0]!.content;
    expect(JSON.stringify(first)).not.toContain(FILE_ID);
    const second = userMessages[1]!.content as any[];
    expect(second.some(p => p.type === 'file' && p.data === FILE_ID)).toBe(true);
  });

  it('drops attachment-only messages (empty parts) uniformly for file IDs and URLs (pre-existing sanitizer behavior)', () => {
    const fileIdOnly = aiV4UIMessagesToAIV4CoreMessages([
      {
        id: '1',
        role: 'user',
        content: '',
        parts: [],
        experimental_attachments: [{ url: FILE_ID, contentType: 'application/pdf' }],
      },
    ]);
    const urlOnly = aiV4UIMessagesToAIV4CoreMessages([
      {
        id: '1',
        role: 'user',
        content: '',
        parts: [],
        experimental_attachments: [{ url: 'https://example.com/doc.pdf', contentType: 'application/pdf' }],
      },
    ]);
    // sanitizeAIV4UIMessages removes messages with empty parts for ALL attachment kinds
    expect(fileIdOnly).toEqual(urlOnly);
  });

  it('keeps a file-ID attachment alongside an empty text part (realistic stored shape)', () => {
    const core = aiV4UIMessagesToAIV4CoreMessages([
      {
        id: '1',
        role: 'user',
        content: '',
        parts: [{ type: 'text', text: '' }],
        experimental_attachments: [{ url: FILE_ID, contentType: 'application/pdf' }],
      },
    ]);
    expect(core).toHaveLength(1);
    const content = core[0]!.content as any[];
    expect(content.some(p => p.type === 'file' && p.data === FILE_ID)).toBe(true);
  });

  it('falls back to application/octet-stream when the attachment has no contentType', () => {
    const core = aiV4UIMessagesToAIV4CoreMessages([
      {
        id: '1',
        role: 'user',
        content: 'no content type',
        parts: [{ type: 'text', text: 'no content type' }],
        experimental_attachments: [{ url: FILE_ID }],
      },
    ]);
    const content = core[0]!.content as any[];
    const filePart = content.find(p => p.type === 'file' && p.data === FILE_ID);
    expect(filePart.mimeType).toBe('application/octet-stream');
  });
});
