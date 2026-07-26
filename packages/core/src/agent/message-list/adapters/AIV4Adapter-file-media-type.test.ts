import { describe, it, expect } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import { AIV4Adapter } from './AIV4Adapter';

describe('AIV4Adapter.toUIMessage — v5-shaped file parts (mediaType)', () => {
  const userMessage = (parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
    id: 'm1',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    threadId: 't1',
    resourceId: 'r1',
    content: { format: 2, parts },
  });

  // v5 shape: `mediaType`/`data`. The stored union only describes v4, so cast at the boundary.
  const v5FilePart = (mediaType: string, data: string) =>
    ({ type: 'file', mediaType, data }) as unknown as MastraDBMessage['content']['parts'][number];

  it('carries the media type into experimental_attachments.contentType for a v5 file part', () => {
    const ui = AIV4Adapter.toUIMessage(userMessage([v5FilePart('application/pdf', 'JVBERi0xLjQ=')]));
    const attachment = ui.experimental_attachments?.[0];
    expect(attachment).toBeDefined();
    expect(attachment!.contentType).toBe('application/pdf');
    expect(attachment!.url).toBe('data:application/pdf;base64,JVBERi0xLjQ=');
  });

  it('still works for a persisted v4 file part (mimeType/data)', () => {
    const v4FilePart = {
      type: 'file',
      mimeType: 'application/pdf',
      data: 'JVBERi0xLjQ=',
    } as MastraDBMessage['content']['parts'][number];
    const ui = AIV4Adapter.toUIMessage(userMessage([v4FilePart]));
    const attachment = ui.experimental_attachments?.[0];
    expect(attachment!.contentType).toBe('application/pdf');
    expect(attachment!.url).toBe('data:application/pdf;base64,JVBERi0xLjQ=');
  });
});
