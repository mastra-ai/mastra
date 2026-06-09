// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import {
  ComposerAttachmentsProvider,
  useComposerAttachments,
  type ComposerAttachment,
} from '../composer-attachments';

afterEach(() => cleanup());

interface CaptureRef {
  current: ReturnType<typeof useComposerAttachments> | null;
}

const Capture = ({ into }: { into: CaptureRef }) => {
  const ctx = useComposerAttachments();
  useEffect(() => {
    into.current = ctx;
  });
  return (
    <ul>
      {ctx.attachments.map(a => (
        <li key={a.id} data-kind={a.kind}>
          {a.name}
        </li>
      ))}
    </ul>
  );
};

const renderProvider = () => {
  const ref: CaptureRef = { current: null };
  const utils = render(
    <ComposerAttachmentsProvider>
      <Capture into={ref} />
    </ComposerAttachmentsProvider>,
  );
  return { ref, ...utils };
};

const imageFile = () => new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
const textFile = () => new File(['hello world'], 'notes.txt', { type: 'text/plain' });
const pdfFile = () => new File(['pdf-bytes'], 'doc.pdf', { type: 'application/pdf' });

describe('composer attachments', () => {
  it('adds files and classifies them by kind', () => {
    const { ref } = renderProvider();

    act(() => {
      ref.current!.addFiles([imageFile(), textFile(), pdfFile()]);
    });

    const kinds = ref.current!.attachments.map(a => a.kind);
    expect(kinds).toEqual(['image', 'text', 'pdf']);
  });

  it('removes a single attachment by id and clears all', () => {
    const { ref } = renderProvider();

    act(() => {
      ref.current!.addFiles([imageFile(), textFile()]);
    });
    const firstId = ref.current!.attachments[0]!.id;

    act(() => {
      ref.current!.remove(firstId);
    });
    expect(ref.current!.attachments.map(a => a.name)).toEqual(['notes.txt']);

    act(() => {
      ref.current!.clear();
    });
    expect(ref.current!.attachments).toHaveLength(0);
  });

  it('converts image / pdf / text attachments to CoreUserMessages', async () => {
    const { ref } = renderProvider();

    act(() => {
      ref.current!.addFiles([imageFile(), pdfFile(), textFile()]);
    });

    const messages = await ref.current!.toCoreUserMessages();
    expect(messages).toHaveLength(3);

    const [image, pdf, text] = messages;
    // image part
    expect(Array.isArray(image!.content)).toBe(true);
    const imagePart = (image!.content as Array<{ type: string; mimeType?: string }>)[0];
    expect(imagePart!.type).toBe('image');
    expect(imagePart!.mimeType).toBe('image/png');

    // pdf -> file part with data: prefix
    const pdfPart = (pdf!.content as Array<{ type: string; data?: string; filename?: string }>)[0];
    expect(pdfPart!.type).toBe('file');
    expect(pdfPart!.filename).toBe('doc.pdf');
    expect(pdfPart!.data).toMatch(/^data:application\/pdf;base64,/);

    // text -> plain string content
    expect(text!.content).toBe('hello world');
  });

  it('adds a URL attachment whose data forwards the URL, not base64', async () => {
    server.use(
      http.head('https://example.com/pic.png', () =>
        new HttpResponse(null, { status: 200, headers: { 'content-type': 'image/png' } }),
      ),
    );
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addUrl('https://example.com/pic.png');
    });

    const att = ref.current!.attachments[0] as ComposerAttachment;
    expect(att.isUrl).toBe(true);
    expect(att.kind).toBe('image');

    const messages = await ref.current!.toCoreUserMessages();
    const imagePart = (messages[0]!.content as Array<{ type: string; image?: string }>)[0];
    expect(imagePart!.image).toBe('https://example.com/pic.png');
  });
});
