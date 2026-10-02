import { describe, expect, it } from 'vitest';

import { buildUploadPath, toDisplayName } from './file-upload-filename';

const UUID = '11111111-2222-4333-8444-555555555555';

describe('buildUploadPath', () => {
  it.each([
    ['notes.txt', 'notes', '.txt'],
    ['rapport Q3 (final).pdf', 'rapport_Q3_final', '.pdf'],
    ['résumé été.PDF', 'resume_ete', '.pdf'],
    ['../../etc/passwd', 'etc_passwd', ''],
    ['..\\..\\windows\\system32\\config.sys', 'windows_system32_config', '.sys'],
    ['\u001b[31mred\u001b[0m.txt', 'red', '.txt'],
    ['line\nbreak\u0000.txt', 'linebreak', '.txt'],
    ['日本語.txt', 'file', '.txt'],
    ['; rm -rf ~ #.sh', 'rm_-rf', '.sh'],
    ['$(whoami)`id`.txt', 'whoami_id', '.txt'],
    ['.env', 'env', ''],
    ['archive.tar.gz', 'archive.tar', '.gz'],
    ['Makefile', 'Makefile', ''],
    ['notes.t$x t', 'notes', '.txt'],
    ['...', 'file', ''],
    [`${'x'.repeat(300)}.txt`, 'x'.repeat(100), '.txt'],
  ])('turns %j into a safe path', (fileName, base, extension) => {
    expect(buildUploadPath(fileName, 'application/octet-stream', UUID)).toBe(`uploads/${base}-${UUID}${extension}`);
  });

  it.each([
    [undefined, 'image/png', '.png'],
    ['', 'application/pdf', '.pdf'],
    [undefined, 'TEXT/PLAIN; charset=utf-8', '.txt'],
    [undefined, 'application/x-unknown', ''],
  ])('names a file sent as %j with type %s after its MIME type', (fileName, mimeType, extension) => {
    expect(buildUploadPath(fileName, mimeType, UUID)).toBe(`uploads/file-${UUID}${extension}`);
  });

  it('only ever produces characters that are safe in a shell and a path', () => {
    const hostile = ['a b', "it's", '"q"', 'a;b|c&d', 'tab\there', '~/x', 'é/è\\ê', '*?[]{}<>!'].join('');

    expect(buildUploadPath(`${hostile}.txt`, 'text/plain', UUID)).toMatch(/^uploads\/[A-Za-z0-9._-]+$/);
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
