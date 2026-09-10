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

describe('composer attachments', () => {
  describe('when a text file is attached', () => {
    it.each([
      ['leads.csv', 'application/vnd.ms-excel'],
      ['notes.txt', 'text/plain'],
      ['data.json', 'application/json'],
      ['notes.md', 'text/markdown'],
      ['config.yaml', 'application/yaml'],
    ])('sends %s as readable text with the existing collapsed attachment envelope', async (name, browserType) => {
      const { ref } = renderProvider();
      const text = 'name,note\r\nZoë,"hello\nworld"\r\n';
      await act(async () => {
        await ref.current!.addFiles([new File([text], name, { type: browserType })]);
      });
      expect(ref.current!.attachments[0]?.kind).toBe('text');
      expect(await ref.current!.toCoreUserMessages()).toEqual([
        { role: 'user', content: `<attachment name="${name}">${text}</attachment>` },
      ]);
    });
  });
  describe('when a file has an unrecognized text extension', () => {
    it.each(['settings.ini', 'main.go', 'notebook.ipynb', '.env', 'README'])(
      'accepts readable %s contents without requiring a MIME type',
      async name => {
        const { ref } = renderProvider();
        await act(async () => {
          await ref.current!.addFiles([
            new File(['hello Zoë\r\n', '\t\f'], name, { type: 'application/octet-stream' }),
          ]);
        });
        expect(await ref.current!.toCoreUserMessages()).toEqual([
          { role: 'user', content: `<attachment name="${name}">hello Zoë\r\n\t\f</attachment>` },
        ]);
      },
    );
  });

  describe('when a local workbook name contains URL punctuation', () => {
    it.each(['leads#2026.xlsx', 'leads.csv#2026.xlsx', 'leads.csv?2026.xls'])(
      'rejects %s rather than reading its bytes as text',
      async name => {
        const { ref } = renderProvider();
        let rejected;
        await act(async () => {
          rejected = await ref.current!.addFiles([new File(['fake workbook'], name)]);
        });
        expect(rejected).toEqual([name]);
        expect(ref.current!.attachments).toEqual([]);
      },
    );
  });

  describe('when an empty text file has markup in its filename', () => {
    it('escapes the envelope name without changing the empty content', async () => {
      const { ref } = renderProvider();
      await act(async () => {
        await ref.current!.addFiles([new File([], 'a&"<b>.txt', { type: 'text/plain' })]);
      });
      expect(await ref.current!.toCoreUserMessages()).toEqual([
        { role: 'user', content: '<attachment name="a&amp;&quot;&lt;b&gt;.txt"></attachment>' },
      ]);
    });
  });

  describe('when unsupported binary files are selected', () => {
    it.each(['leads.xls', 'leads.xlsx', 'archive.zip', 'file.constructor'])(
      'rejects %s while keeping supported files in the same selection',
      async name => {
        const { ref } = renderProvider();
        let rejected: string[] = [];
        await act(async () => {
          rejected = await ref.current!.addFiles([textFile(), new File([new Uint8Array([80, 75, 0, 1, 2])], name)]);
        });
        expect(rejected).toEqual([name]);
        expect(ref.current!.attachments.map(file => file.name)).toEqual(['notes.txt']);
        expect(await ref.current!.toCoreUserMessages()).toEqual([
          { role: 'user', content: '<attachment name="notes.txt">hello world</attachment>' },
        ]);
      },
    );
  });

  it('adds files and classifies them by kind', async () => {
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addFiles([imageFile(), textFile(), pdfFile()]);
    });

    const kinds = ref.current!.attachments.map(a => a.kind);
    expect(kinds).toEqual(['image', 'text', 'pdf']);
  });

  it('removes a single attachment by id and clears all', async () => {
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addFiles([imageFile(), textFile()]);
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

    await act(async () => {
      await ref.current!.addFiles([imageFile(), pdfFile(), textFile()]);
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
    // The data URL prefix must appear exactly once; `fileToBase64` already
    // returns a full data URL, so it must not be prepended a second time.
    expect(pdfPart!.data).not.toMatch(/data:application\/pdf;base64,data:/);

    expect(text!.content).toBe('<attachment name="notes.txt">hello world</attachment>');
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

  it('classifies a gs:// URL as a forwarded URL attachment', async () => {
    // No HEAD handler: fetch('gs://...') rejects, so the content type is
    // inferred from the extension (video/mp4).
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addUrl('gs://my-bucket/clip.mp4');
    });

    const att = ref.current!.attachments[0] as ComposerAttachment;
    expect(att.isUrl).toBe(true);
    expect(att.kind).toBe('video');
    expect(att.contentType).toBe('video/mp4');
  });

  it('forwards a gs:// video as a file part containing the raw URI', async () => {
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addUrl('gs://my-bucket/clip.mp4');
    });

    const messages = await ref.current!.toCoreUserMessages();
    const filePart = (messages[0]!.content as Array<{ type: string; data?: string; mimeType?: string }>)[0];
    expect(filePart!.type).toBe('file');
    expect(filePart!.data).toBe('gs://my-bucket/clip.mp4');
    expect(filePart!.mimeType).toBe('video/mp4');
  });

  it('forwards an audio URL as a file part instead of empty text', async () => {
    // Audio shares the file-chip ('video') path so the URL is forwarded as a
    // file part rather than falling through to the empty-text branch.
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addUrl('gs://my-bucket/track.mp3');
    });

    const att = ref.current!.attachments[0] as ComposerAttachment;
    expect(att.isUrl).toBe(true);
    expect(att.kind).toBe('video');
    expect(att.contentType).toBe('audio/mpeg');

    const messages = await ref.current!.toCoreUserMessages();
    const filePart = (messages[0]!.content as Array<{ type: string; data?: string; mimeType?: string }>)[0];
    expect(filePart!.type).toBe('file');
    expect(filePart!.data).toBe('gs://my-bucket/track.mp3');
    expect(filePart!.mimeType).toBe('audio/mpeg');
  });

  it('inlines a local video file as a data URI file part', async () => {
    const { ref } = renderProvider();

    await act(async () => {
      await ref.current!.addFiles([new File(['video-bytes'], 'movie.mp4', { type: 'video/mp4' })]);
    });

    const att = ref.current!.attachments[0] as ComposerAttachment;
    expect(att.kind).toBe('video');
    expect(att.isUrl).toBe(false);

    const messages = await ref.current!.toCoreUserMessages();
    const filePart = (messages[0]!.content as Array<{ type: string; data?: string }>)[0];
    expect(filePart!.type).toBe('file');
    // A single, well-formed data URI — guards against double-wrapping the
    // base64 payload (e.g. `data:video/mp4;base64,data:video/mp4;base64,...`).
    expect(filePart!.data).toMatch(/^data:video\/mp4;base64,[^,]+$/);
    expect(filePart!.data).not.toContain('base64,data:');
  });
});
