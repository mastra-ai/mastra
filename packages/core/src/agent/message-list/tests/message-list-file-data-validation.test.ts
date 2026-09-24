import { describe, expect, it } from 'vitest';
import { MastraError } from '../../../error';
import { MessageList } from '../index';

function addUserFile(part: Record<string, unknown>) {
  const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
  list.add({ role: 'user', content: [{ type: 'text', text: 'look' }, part] } as any, 'input');
  return list;
}

function storedFileData(list: MessageList) {
  const part = list.get.all.db()[0]!.content.parts.find(p => p.type === 'file') as { data: string } | undefined;
  return part?.data;
}

function catchError(fn: () => unknown): MastraError {
  try {
    fn();
  } catch (error) {
    return error as MastraError;
  }
  throw new Error('expected an error');
}

describe('MessageList input file data validation', () => {
  it.each([
    ['AI SDK v5 file part', { type: 'file', data: '/api/images/foo.svg', mediaType: 'image/svg+xml' }],
    ['AI SDK v5 image part', { type: 'image', image: '/relative/path.png', mediaType: 'image/png' }],
    ['AI SDK v4 file part', { type: 'file', data: 'relative/path.png', mimeType: 'image/png' }],
    ['protocol-relative URL', { type: 'file', data: '//cdn.example.com/a.png', mediaType: 'image/png' }],
  ])('rejects a %s that is neither a URL nor base64', (_label, part) => {
    const error = catchError(() => addUserFile(part));

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toBe('INVALID_FILE_PART_DATA');
    expect(error.message).toContain('expected an absolute URL');
  });

  it('rejects a relative path in a UI message file part', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    const error = catchError(() =>
      list.add(
        {
          id: 'ui-1',
          role: 'user',
          parts: [{ type: 'file', url: '/api/images/foo.png', mediaType: 'image/png' }],
        } as any,
        'input',
      ),
    );

    expect(error.id).toBe('INVALID_FILE_PART_DATA');
  });

  it.each([
    ['https URL', 'https://example.com/a.png', 'https://example.com/a.png'],
    ['gs URL', 'gs://bucket/a.png', 'gs://bucket/a.png'],
    ['s3 URL', 's3://bucket/a.png', 's3://bucket/a.png'],
    ['OpenAI file ID', 'file-abc123', 'file-abc123'],
    ['data URL', 'data:image/png;base64,iVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGgo='],
    ['raw base64', 'iVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGgo='],
    ['raw JPEG base64 (leading slash)', '/9j/4AAQSkZJRg==', 'data:image/png;base64,/9j/4AAQSkZJRg=='],
  ])('accepts %s', (_label, data, expected) => {
    const list = addUserFile({ type: 'file', data, mediaType: 'image/png' });

    expect(storedFileData(list)).toBe(expected);
  });

  it('does not reject already-stored messages loaded from memory', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(
      {
        id: 'stored-1',
        role: 'user',
        createdAt: new Date(),
        threadId: 'thread',
        resourceId: 'resource',
        content: { format: 2, parts: [{ type: 'file', data: '/relative/path.png', mimeType: 'image/png' }] },
      },
      'memory',
    );

    expect(storedFileData(list)).toBe('/relative/path.png');
  });

  it('does not reject a malformed data URL replayed as input, so its download failure stays recoverable', () => {
    const data = 'data:image/png;base64,/relative/path.png';
    const list = addUserFile({ type: 'file', data, mediaType: 'image/png' });

    expect(storedFileData(list)).toBe(data);
  });
});
