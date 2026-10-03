import { describe, expect, it } from 'vitest';

import { buildUploadPath, toDisplayName } from './file-upload-filename';

const UUID = '11111111-2222-4333-8444-555555555555';

const THREAD = 'thread-1';

describe('buildUploadPath', () => {
  it.each([
    ['notes.txt', '.txt'],
    ['rapport Q3 (final).pdf', '.pdf'],
    ['résumé été.PDF', '.pdf'],
    ['../../etc/passwd', ''],
    ['..\\..\\windows\\system32\\config.sys', '.sys'],
    ['line\nbreak\u0000.txt', '.txt'],
    ['; rm -rf ~ #.sh', '.sh'],
    ['.env', ''],
    ['archive.tar.gz', '.gz'],
    ['Makefile', ''],
    ['notes.t$x t', '.txt'],
    ['...', ''],
  ])('keeps nothing of the name %j but its extension', (fileName, extension) => {
    const path = buildUploadPath({ threadId: THREAD, uuid: UUID, fileName, mimeType: 'application/octet-stream' });

    expect(path).toBe(`uploads/${THREAD}/${UUID}${extension}`);
  });

  it.each([
    [undefined, 'image/png', '.png'],
    ['', 'application/pdf', '.pdf'],
    [undefined, 'TEXT/PLAIN; charset=utf-8', '.txt'],
    [undefined, 'application/x-unknown', ''],
  ])('takes the extension of a file sent as %j from its type %s', (fileName, mimeType, extension) => {
    expect(buildUploadPath({ threadId: THREAD, uuid: UUID, fileName, mimeType })).toBe(
      `uploads/${THREAD}/${UUID}${extension}`,
    );
  });

  it.each([
    ['3f6c1d2e-8a4b-4c0d-9e21-5b7a6c9d0e1f', '3f6c1d2e-8a4b-4c0d-9e21-5b7a6c9d0e1f'],
    ['../../etc', 'etc'],
    ['support ticket #42', 'support_ticket_42'],
    ['..', 'thread'],
    ['日本語', 'thread'],
    ['', 'thread'],
    ['x'.repeat(300), 'x'.repeat(100)],
  ])('files the upload of thread %j under a safe directory', (threadId, directory) => {
    expect(buildUploadPath({ threadId, uuid: UUID, fileName: 'notes.txt', mimeType: 'text/plain' })).toBe(
      `uploads/${directory}/${UUID}.txt`,
    );
  });

  it('only ever produces characters that are safe in a shell and a path', () => {
    const hostile = ['a b', "it's", '"q"', 'a;b|c&d', 'tab\there', '~/x', 'é/è\\ê', '*?[]{}<>!'].join('');

    expect(
      buildUploadPath({ threadId: hostile, uuid: UUID, fileName: `${hostile}.txt`, mimeType: 'text/plain' }),
    ).toMatch(/^uploads\/[A-Za-z0-9._-]+\/[A-Za-z0-9-]+\.txt$/);
  });
});

describe('toDisplayName', () => {
  it('keeps a normal name as sent', () => {
    expect(toDisplayName('rapport Q3 (final).pdf')).toBe('rapport Q3 (final).pdf');
  });

  it('removes control characters and escape sequences that could forge lines in a note', () => {
    expect(toDisplayName('a\nname: fake\u001b[31m.txt')).toBe('aname: fake.txt');
  });

  it('bounds the length and falls back to a placeholder for a missing name', () => {
    expect(toDisplayName('y'.repeat(500))).toHaveLength(200);
    expect(toDisplayName(undefined)).toBe('unnamed file');
  });
});
