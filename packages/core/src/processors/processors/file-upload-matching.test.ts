import { describe, expect, it } from 'vitest';

import { createFileMatcher } from './file-upload-matching';

describe('createFileMatcher', () => {
  it.each([
    ['image/png', undefined, true],
    ['IMAGE/JPEG', 'photo.JPG', true],
    ['APPLICATION/PDF', 'report.pdf', true],
    ['application/pdf; version=1.7', undefined, true],
    ['text/csv; charset=utf-8', 'data.csv', true],
    ['application/octet-stream', 'bilan.xlsx', true],
    ['application/octet-stream', 'archive.tar.CSV', true],
    ['text/plain', 'notes.txt', false],
    ['text/csv', undefined, false],
    ['application/octet-stream', 'csv', false],
    ['imagery/png', undefined, false],
  ])('matches %s named %s: %s', (mimeType, fileName, expected) => {
    const matches = createFileMatcher({ mimeTypes: ['image/*', 'Application/PDF'], extensions: ['csv', '.XLSX'] });

    expect(matches({ mimeType, fileName })).toBe(expected);
  });

  it.each([[{}], [{ mimeTypes: [], extensions: [], excludeMimeTypes: [] }]])(
    'matches every file when no filter is set (%j)',
    options => {
      const matches = createFileMatcher(options);

      expect(matches({ mimeType: 'application/x-anything', fileName: undefined })).toBe(true);
    },
  );

  it.each([
    ['image/png', 'photo.png', false],
    ['IMAGE/JPEG; quality=90', undefined, false],
    ['application/pdf', 'report.pdf', false],
    ['imagery/png', undefined, true],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'leads.xlsx', true],
    ['application/zip', undefined, true],
  ])('with only an exclusion, matches %s named %s: %s', (mimeType, fileName, expected) => {
    const matches = createFileMatcher({ excludeMimeTypes: ['image/*', 'Application/PDF'] });

    expect(matches({ mimeType, fileName })).toBe(expected);
  });

  it('never matches an excluded type, even when an inclusion filter matches it', () => {
    const matches = createFileMatcher({
      mimeTypes: ['application/*'],
      extensions: ['pdf'],
      excludeMimeTypes: ['application/pdf'],
    });

    expect(matches({ mimeType: 'application/pdf', fileName: 'report.pdf' })).toBe(false);
    expect(matches({ mimeType: 'application/zip', fileName: 'archive.zip' })).toBe(true);
    expect(matches({ mimeType: 'text/plain', fileName: 'notes.txt' })).toBe(false);
  });

  it('applies only the filter that is set', () => {
    const byExtension = createFileMatcher({ mimeTypes: [], extensions: ['md'] });

    expect(byExtension({ mimeType: 'text/markdown', fileName: 'readme.md' })).toBe(true);
    expect(byExtension({ mimeType: 'text/markdown', fileName: undefined })).toBe(false);
  });
});
