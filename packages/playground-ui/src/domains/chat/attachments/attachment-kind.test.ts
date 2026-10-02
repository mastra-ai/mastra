import { describe, expect, it } from 'vitest';

import { classifyAttachment, isTextMimeType } from './attachment-kind';

describe('isTextMimeType', () => {
  it.each([
    'text/plain',
    'text/csv',
    'TEXT/HTML',
    'application/ld+json',
    'image/svg+xml',
    'application/json',
    'application/xml',
    'application/csv',
    'application/x-ndjson',
    'application/yaml',
    'application/x-yaml',
    'application/toml',
    'application/javascript',
    'application/typescript',
    'application/sql',
    'text/plain; charset=utf-8',
  ])('recognises %s as text', mimeType => {
    expect(isTextMimeType(mimeType)).toBe(true);
  });

  it.each(['image/png', 'application/pdf', 'application/octet-stream', 'video/mp4', ''])('rejects %j', mimeType => {
    expect(isTextMimeType(mimeType)).toBe(false);
  });
});

describe('classifyAttachment', () => {
  describe('when the extension is known', () => {
    it('lets the extension override the browser content type', () => {
      expect(classifyAttachment('leads.csv', 'application/vnd.ms-excel')).toEqual({
        kind: 'text',
        contentType: 'text/csv',
      });
    });

    it('is case-insensitive on the extension', () => {
      expect(classifyAttachment('README.MD', '')).toEqual({ kind: 'text', contentType: 'text/markdown' });
    });

    it('classifies spreadsheets as generic files', () => {
      expect(classifyAttachment('leads.xlsx', '').kind).toBe('file');
    });
  });

  describe('when the name is a remote URL', () => {
    it('reads the extension from the pathname, ignoring the query string', () => {
      expect(classifyAttachment('https://example.com/data.json?x=1.png', '')).toEqual({
        kind: 'text',
        contentType: 'application/json',
      });
    });
  });

  describe('when the extension is unknown', () => {
    it('uses the normalized content type', () => {
      expect(classifyAttachment('photo.heic', 'IMAGE/HEIC; foo=bar')).toEqual({
        kind: 'image',
        contentType: 'image/heic',
      });
    });

    it('falls back to application/octet-stream when there is an extension but no content type', () => {
      expect(classifyAttachment('blob.bin', '')).toEqual({ kind: 'file', contentType: 'application/octet-stream' });
    });

    it('falls back to text/plain when there is neither extension nor content type', () => {
      expect(classifyAttachment('notes', '')).toEqual({ kind: 'text', contentType: 'text/plain' });
    });
  });

  describe('kind resolution', () => {
    it('detects PDFs by content type or extension', () => {
      expect(classifyAttachment('doc.pdf', '')).toEqual({ kind: 'pdf', contentType: 'application/pdf' });
      expect(classifyAttachment('doc', 'application/pdf')).toEqual({ kind: 'pdf', contentType: 'application/pdf' });
    });

    it('groups video and audio under the video kind', () => {
      expect(classifyAttachment('clip.mp4', 'video/mp4').kind).toBe('video');
      expect(classifyAttachment('song.mp3', 'audio/mpeg').kind).toBe('video');
    });

    it('keeps text-like content types as text', () => {
      expect(classifyAttachment('x', 'application/ld+json').kind).toBe('text');
    });
  });
});
