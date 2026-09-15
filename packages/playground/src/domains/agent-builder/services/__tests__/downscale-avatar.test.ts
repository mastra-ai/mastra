import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downscaleImageToDataUrl, estimateDataUrlBytes } from '../downscale-avatar';

describe('estimateDataUrlBytes', () => {
  it('returns 0 for a string without a comma', () => {
    expect(estimateDataUrlBytes('no-comma')).toBe(0);
  });

  it('estimates the correct byte length for a small base64 payload', () => {
    // 4 base64 chars = 3 bytes
    const dataUrl = 'data:image/png;base64,AAAA';
    expect(estimateDataUrlBytes(dataUrl)).toBe(3);
  });

  it('accounts for base64 padding (=)', () => {
    // "AA==" → 1 byte (4 chars, 2 padding)
    const dataUrl = 'data:image/png;base64,AA==';
    expect(estimateDataUrlBytes(dataUrl)).toBe(1);

    // "AAA=" → 2 bytes (4 chars, 1 padding)
    const dataUrl2 = 'data:image/png;base64,AAA=';
    expect(estimateDataUrlBytes(dataUrl2)).toBe(2);
  });

  it('estimates correctly for a larger payload', () => {
    // 100 bytes → ceil(100/3)*4 = 136 base64 chars with padding
    const buf = Buffer.alloc(100, 0x42);
    const b64 = buf.toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;
    expect(estimateDataUrlBytes(dataUrl)).toBe(100);
  });

  it('estimates correctly for a 512KB payload', () => {
    const size = 512 * 1024;
    const buf = Buffer.alloc(size, 0);
    const b64 = buf.toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;
    expect(estimateDataUrlBytes(dataUrl)).toBe(size);
  });
});

describe('downscaleImageToDataUrl', () => {
  // A tiny base64 payload that decodes to a known, small byte size.
  // 'AAAA' = 4 base64 chars = 3 bytes when decoded.
  const TINY_DATA_URL = 'data:image/png;base64,AAAA';

  const originalCreateImageBitmap: typeof globalThis.createImageBitmap | undefined = globalThis.createImageBitmap;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
  let drawImage: ReturnType<typeof vi.fn>;
  let toDataURL: ReturnType<typeof vi.fn>;
  let getContext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bitmap = { width: 1024, height: 1024, close: vi.fn() };
    drawImage = vi.fn();
    toDataURL = vi.fn(() => TINY_DATA_URL);
    getContext = vi.fn(() => ({ drawImage }) as unknown as CanvasRenderingContext2D);

    Object.defineProperty(globalThis, 'createImageBitmap', {
      value: vi.fn(async () => bitmap),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: getContext,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: toDataURL,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalCreateImageBitmap === undefined) {
      delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
    } else {
      Object.defineProperty(globalThis, 'createImageBitmap', {
        value: originalCreateImageBitmap,
        configurable: true,
        writable: true,
      });
    }
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: originalGetContext,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: originalToDataURL,
      configurable: true,
      writable: true,
    });
  });

  it('returns image/png contentType for a PNG file', async () => {
    const file = new File(['stub'], 'a.png', { type: 'image/png' });

    const result = await downscaleImageToDataUrl(file);

    expect(result.contentType).toBe('image/png');
    expect(result.dataUrl).toBe(TINY_DATA_URL);
    expect(toDataURL).toHaveBeenCalledWith('image/png', expect.any(Number));
  });

  it('returns image/jpeg contentType for non-PNG sources', async () => {
    const file = new File(['stub'], 'a.jpg', { type: 'image/jpeg' });

    const result = await downscaleImageToDataUrl(file);

    expect(result.contentType).toBe('image/jpeg');
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', expect.any(Number));
  });

  it('center-crops a taller-than-wide source into a square region', async () => {
    bitmap.width = 200;
    bitmap.height = 600;
    const file = new File(['stub'], 'a.png', { type: 'image/png' });

    await downscaleImageToDataUrl(file);

    // side = min(200, 600) = 200; sx = 0; sy = (600 - 200) / 2 = 200
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 200, 200, 200, 0, 0, 256, 256);
  });

  it('throws when canvas 2D context is unavailable', async () => {
    getContext.mockReturnValueOnce(null);
    const file = new File(['stub'], 'a.png', { type: 'image/png' });

    await expect(downscaleImageToDataUrl(file)).rejects.toThrow('Canvas 2D context is not available');
  });

  it('throws when the encoded result exceeds 512 KB', async () => {
    // Build a base64 payload that decodes to > 512KB.
    const oversizedBytes = 512 * 1024 + 1;
    const oversizedB64 = Buffer.alloc(oversizedBytes, 0).toString('base64');
    toDataURL.mockReturnValueOnce(`data:image/png;base64,${oversizedB64}`);
    const file = new File(['stub'], 'a.png', { type: 'image/png' });

    await expect(downscaleImageToDataUrl(file)).rejects.toThrow(/too large after downscaling/);
  });
});
