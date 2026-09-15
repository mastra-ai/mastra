import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { writeMjpegAviFile } from '../mjpeg-avi.js';

describe('writeMjpegAviFile', () => {
  it('rejects frames that are not JPEG bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mastracode-avi-'));
    try {
      expect(() =>
        writeMjpegAviFile(join(dir, 'bad.avi'), [{ bytes: new Uint8Array([0x00, 0x00]), timestampMs: 0 }], {
          width: 16,
          height: 16,
        }),
      ).toThrow(/not a JPEG frame/i);
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects AVI fields that exceed 32-bit container limits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mastracode-avi-'));
    const hugeFrame = {
      0: 0xff,
      1: 0xd8,
      length: 0xffffffff,
    } as unknown as Uint8Array;
    try {
      expect(() =>
        writeMjpegAviFile(join(dir, 'huge.avi'), [{ bytes: hugeFrame, timestampMs: 0 }], {
          width: 16,
          height: 16,
        }),
      ).toThrow(/32-bit AVI limit/i);
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });
});
