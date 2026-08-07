import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter.toUIMessage — v5-shaped file parts (mediaType) via V2->V5', () => {
  const userMessage = (parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
    id: 'msg-1',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    threadId: 't1',
    resourceId: 'r1',
    content: { format: 2, parts },
  });

  // v5 shape: `mediaType`/`data`, no `mimeType`. The stored union only describes the
  // v4 shape, so cast at the boundary.
  const v5FilePart = (mediaType: string, data: string) =>
    ({ type: 'file', mediaType, data }) as unknown as MastraDBMessage['content']['parts'][number];

  // True v5 `FileUIPart` shape: `mediaType`/`url`, with the payload in `url` and no `data`.
  const v5FilePartUrl = (mediaType: string, url: string) =>
    ({ type: 'file', mediaType, url }) as unknown as MastraDBMessage['content']['parts'][number];

  it('carries the media type into the FileUIPart when only `mediaType` (no `mimeType`) is stored', () => {
    // Raw base64 (not a data: URI, not an http(s) URL) is essential here: `categorizeFileData`
    // only recovers a mime type from a data: URI or from the fallback we pass in, so this
    // exercises the `mediaType` fallback path specifically instead of a URI-embedded type.
    const dbMessage = userMessage([v5FilePart('application/pdf', 'JVBERi0xLjQ=')]);

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);
    const filePart = uiMessage.parts.find(p => p.type === 'file');

    expect(filePart).toBeDefined();
    expect(filePart).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
      url: 'data:application/pdf;base64,JVBERi0xLjQ=',
    });
  });

  it('reads the payload from `url` for a true v5 FileUIPart (mediaType/url, no data)', () => {
    // A true v5 `FileUIPart` carries the payload in `url`, not `data`. Reading only
    // `part.data` would drop it and hit `createDataUri(undefined, …)`, producing a
    // `data:…;base64,undefined` URL instead of the real link.
    const dbMessage = userMessage([v5FilePartUrl('application/pdf', 'https://example.com/doc.pdf')]);

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);
    const filePart = uiMessage.parts.find(p => p.type === 'file');

    expect(filePart).toBeDefined();
    expect(filePart).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
      url: 'https://example.com/doc.pdf',
    });
  });

  it('still works for a persisted v4 file part (mimeType/data)', () => {
    const v4FilePart = {
      type: 'file',
      mimeType: 'application/pdf',
      data: 'JVBERi0xLjQ=',
    } as MastraDBMessage['content']['parts'][number];

    const uiMessage = AIV5Adapter.toUIMessage(userMessage([v4FilePart]));
    const filePart = uiMessage.parts.find(p => p.type === 'file');

    expect(filePart).toBeDefined();
    expect(filePart).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
      url: 'data:application/pdf;base64,JVBERi0xLjQ=',
    });
  });
});
