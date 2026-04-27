import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: mocks.execSync,
}));

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync,
  unlinkSync: mocks.unlinkSync,
}));

import { getClipboardImage } from '../index.js';

describe('getClipboardImage', () => {
  beforeEach(() => {
    mocks.execSync.mockReset();
    mocks.readFileSync.mockReset();
    mocks.unlinkSync.mockReset();
    mocks.readFileSync.mockReturnValue(Buffer.from('clipboard-image-binary'));
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads png clipboard images on macOS', () => {
    mocks.execSync.mockReturnValueOnce(undefined);

    expect(getClipboardImage()).toEqual({
      data: Buffer.from('clipboard-image-binary').toString('base64'),
      mimeType: 'image/png',
    });
  });

  it('falls back to TIFF clipboard coercion for macOS screenshots', () => {
    mocks.execSync.mockImplementationOnce(() => {
      throw new Error('PNG clipboard coercion failed');
    });
    mocks.execSync.mockReturnValueOnce(undefined);

    expect(getClipboardImage()).toEqual({
      data: Buffer.from('clipboard-image-binary').toString('base64'),
      mimeType: 'image/tiff',
    });
  });

  it('returns null when direct macOS image coercions all fail', () => {
    mocks.execSync.mockImplementation(() => {
      throw new Error('clipboard coercion failed');
    });

    expect(getClipboardImage()).toBeNull();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(mocks.execSync).toHaveBeenCalledTimes(3);
  });
});
