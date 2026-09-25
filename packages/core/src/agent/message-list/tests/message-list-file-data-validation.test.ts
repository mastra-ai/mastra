import { describe, expect, it } from 'vitest';
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

describe('MessageList input file data', () => {
  it.each([
    [
      'AI SDK v5 file part',
      { type: 'file', data: '/api/images/foo.svg', mediaType: 'image/svg+xml' },
      '/api/images/foo.svg',
    ],
    [
      'AI SDK v5 image part',
      { type: 'image', image: '/relative/path.png', mediaType: 'image/png' },
      '/relative/path.png',
    ],
    [
      'protocol-relative URL',
      { type: 'file', data: '//cdn.example.com/a.png', mediaType: 'image/png' },
      '//cdn.example.com/a.png',
    ],
  ])(
    'keeps a %s that is neither a URL nor base64 as-is instead of wrapping it as a data URL',
    (_label, part, expected) => {
      const list = addUserFile(part);

      expect(storedFileData(list)).toBe(expected);
    },
  );

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
});
