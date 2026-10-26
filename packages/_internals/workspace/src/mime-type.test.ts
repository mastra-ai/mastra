import { getMimeType as coreGetMimeType } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { getMimeType, MIME_TYPES } from './mime-type';

describe('getMimeType', () => {
  it("matches core's lookup for every extension in the table", () => {
    for (const ext of Object.keys(MIME_TYPES)) {
      expect(getMimeType(`/w/file.${ext}`), ext).toBe(coreGetMimeType(`/w/file.${ext}`));
    }
  });

  it('is case-insensitive and falls back to application/octet-stream', () => {
    expect(getMimeType('/w/PHOTO.PNG')).toBe('image/png');
    expect(getMimeType('/w/Makefile')).toBe('application/octet-stream');
    expect(getMimeType('/w/file.unknownext')).toBe('application/octet-stream');
    expect(getMimeType('/w/file.constructor')).toBe('application/octet-stream');
  });
});
