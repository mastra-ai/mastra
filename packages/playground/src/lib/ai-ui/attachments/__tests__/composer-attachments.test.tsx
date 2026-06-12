// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ComposerAttachmentsProvider, useComposerAttachments } from '../composer-attachments';
import type { ComposerAttachment } from '../composer-attachments';
import { server } from '@/test/msw-server';

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
const xlsxFile = () =>
  new File(['xlsx-bytes'], 'questionnaire.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

const flagWindow = window as unknown as { MASTRA_STUDIO_ATTACHMENT_TYPES?: string };

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
      http.head(
        'https://example.com/pic.png',
        () => new HttpResponse(null, { status: 200, headers: { 'content-type': 'image/png' } }),
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

  it('converts binary non-pdf attachments to file parts with their own mime type', async () => {
    const { ref } = renderProvider();

    act(() => {
      ref.current!.addFiles([xlsxFile()]);
    });

    expect(ref.current!.attachments[0]!.kind).toBe('file');

    const messages = await ref.current!.toCoreUserMessages();
    const filePart = (messages[0]!.content as Array<{ type: string; data?: string; filename?: string }>)[0];
    expect(filePart!.type).toBe('file');
    expect(filePart!.filename).toBe('questionnaire.xlsx');
    expect(filePart!.data).toMatch(
      /^data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,/,
    );
  });
});

describe('configured attachment type allowlist', () => {
  afterEach(() => {
    delete flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES;
  });

  it('accepts all file types when unconfigured', () => {
    const { ref } = renderProvider();

    let rejected: string[] = [];
    act(() => {
      rejected = ref.current!.addFiles([imageFile(), xlsxFile()]);
    });

    expect(rejected).toEqual([]);
    expect(ref.current!.attachments).toHaveLength(2);
  });

  it('filters disallowed files and reports their names', () => {
    flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES = 'image/*,application/pdf';
    const { ref } = renderProvider();

    let rejected: string[] = [];
    act(() => {
      rejected = ref.current!.addFiles([imageFile(), xlsxFile(), pdfFile()]);
    });

    expect(rejected).toEqual(['questionnaire.xlsx']);
    expect(ref.current!.attachments.map(a => a.name)).toEqual(['photo.png', 'doc.pdf']);
  });

  it('allows additional types when configured', () => {
    flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES =
      'image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const { ref } = renderProvider();

    let rejected: string[] = [];
    act(() => {
      rejected = ref.current!.addFiles([xlsxFile(), textFile()]);
    });

    expect(rejected).toEqual(['notes.txt']);
    expect(ref.current!.attachments.map(a => a.kind)).toEqual(['file']);
  });

  it('rejects URL attachments whose content type is not allowed', async () => {
    flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES = 'image/*';
    server.use(
      http.head(
        'https://example.com/report.pdf',
        () => new HttpResponse(null, { status: 200, headers: { 'content-type': 'application/pdf' } }),
      ),
    );
    const { ref } = renderProvider();

    let added = true;
    await act(async () => {
      added = await ref.current!.addUrl('https://example.com/report.pdf');
    });

    expect(added).toBe(false);
    expect(ref.current!.attachments).toHaveLength(0);
  });
});
