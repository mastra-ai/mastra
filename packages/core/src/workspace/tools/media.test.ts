import { describe, expect, it } from 'vitest';

import { MEDIA_SNIFF_BYTES, contentMediaType } from './media';

/** `pad` bytes of text followed by a PDF version header, as a PDF with leading junk is stored. */
function pdfWithHeaderAt(pad: number) {
  return Buffer.concat([Buffer.alloc(pad, 0x20), Buffer.from('%PDF-1.4\n')]);
}

// read_file and skill_read read different amounts of a file before sniffing it. The same file
// must get the same answer from both, so the window is fixed at MEDIA_SNIFF_BYTES.
describe('contentMediaType sniff window', () => {
  it('recognizes a PDF whose header ends on the last byte of the window', () => {
    expect(contentMediaType(pdfWithHeaderAt(MEDIA_SNIFF_BYTES - '%PDF-1.4'.length), 'application/pdf')).toBe(
      'application/pdf',
    );
  });

  it('ignores a PDF header that straddles the end of the window, however much the caller read', () => {
    expect(contentMediaType(pdfWithHeaderAt(MEDIA_SNIFF_BYTES - 6), 'application/pdf')).toBeUndefined();
  });
});
