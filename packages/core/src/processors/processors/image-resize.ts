import { deflateSync, inflateSync } from 'node:zlib';
import { decode as decodeJpegBytes, encode as encodeJpegBytes } from 'jpeg-js';

/**
 * Pure-JS image downscaling for PNG and JPEG, so processors can shrink
 * oversized images without a native dependency. Other formats, and PNG
 * variants this decoder doesn't read (interlaced, below 8 bits per sample),
 * are reported as unsupported and left to the caller.
 */

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ResizedImage extends ImageDimensions {
  data: Uint8Array;
  mediaType: 'image/png' | 'image/jpeg';
}

interface RgbaImage extends ImageDimensions {
  data: Uint8Array;
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 24 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

/** Reads the dimensions of a PNG or JPEG from its header, without decoding the pixels. */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (isPng(bytes)) {
    return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
  }
  if (isJpeg(bytes)) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return undefined;
      const marker = bytes[offset + 1]!;
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
          width: (bytes[offset + 7]! << 8) | bytes[offset + 8]!,
        };
      }
      offset += 2 + length;
    }
  }
  return undefined;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

function decodePng(bytes: Uint8Array): RgbaImage | undefined {
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  let transparency: Uint8Array | undefined;
  const idat: Uint8Array[] = [];

  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = readUint32(chunk, 0);
      height = readUint32(chunk, 4);
      bitDepth = chunk[8]!;
      colorType = chunk[9]!;
      interlace = chunk[12]!;
    } else if (type === 'PLTE') {
      palette = chunk;
    } else if (type === 'tRNS') {
      transparency = chunk;
    } else if (type === 'IDAT') {
      idat.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }

  const channelsByColorType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels || !width || !height || interlace !== 0) return undefined;
  if (bitDepth !== 8 && !(bitDepth === 16 && colorType !== 3)) return undefined;
  if (colorType === 3 && !palette) return undefined;

  const bytesPerSample = bitDepth / 8;
  const bytesPerPixel = channels * bytesPerSample;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) return undefined;

  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  let current = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart]!;
    for (let x = 0; x < stride; x++) {
      const value = raw[rowStart + 1 + x]!;
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel]! : 0;
      const up = previous[x]!;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel]! : 0;
      switch (filter) {
        case 0:
          current[x] = value;
          break;
        case 1:
          current[x] = value + left;
          break;
        case 2:
          current[x] = value + up;
          break;
        case 3:
          current[x] = value + ((left + up) >> 1);
          break;
        case 4:
          current[x] = value + paeth(left, up, upLeft);
          break;
        default:
          return undefined;
      }
    }

    for (let x = 0; x < width; x++) {
      // For 16-bit samples the high byte is enough for a downscaled preview.
      const sample = (channel: number) => current[x * bytesPerPixel + channel * bytesPerSample]!;
      const out = (y * width + x) * 4;
      if (colorType === 3) {
        const index = sample(0);
        rgba[out] = palette![index * 3] ?? 0;
        rgba[out + 1] = palette![index * 3 + 1] ?? 0;
        rgba[out + 2] = palette![index * 3 + 2] ?? 0;
        rgba[out + 3] = transparency?.[index] ?? 255;
      } else if (colorType === 0 || colorType === 4) {
        const gray = sample(0);
        rgba[out] = rgba[out + 1] = rgba[out + 2] = gray;
        rgba[out + 3] = colorType === 4 ? sample(1) : 255;
      } else {
        rgba[out] = sample(0);
        rgba[out + 1] = sample(1);
        rgba[out + 2] = sample(2);
        rgba[out + 3] = colorType === 6 ? sample(3) : 255;
      }
    }
    [previous, current] = [current, previous];
  }

  return { width, height, data: rgba };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  chunk.set(data, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function encodePng({ width, height, data }: RgbaImage): Uint8Array {
  const stride = width * 4;
  // Each row uses the Sub filter: cheap, and compresses screenshots well.
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    filtered[rowStart] = 1;
    for (let x = 0; x < stride; x++) {
      const value = data[y * stride + x]!;
      const left = x >= 4 ? data[y * stride + x - 4]! : 0;
      filtered[rowStart + 1 + x] = (value - left) & 0xff;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(filtered)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/** Area-averages the source pixels behind each target pixel, weighting color by alpha. */
function downsample(source: RgbaImage, width: number, height: number): RgbaImage {
  const out = new Uint8Array(width * height * 4);
  const xScale = source.width / width;
  const yScale = source.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * yScale);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yScale));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * xScale);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xScale));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const index = (sy * source.width + sx) * 4;
          const alpha = source.data[index + 3]!;
          r += source.data[index]! * alpha;
          g += source.data[index + 1]! * alpha;
          b += source.data[index + 2]! * alpha;
          a += alpha;
        }
      }
      const target = (y * width + x) * 4;
      const count = (y1 - y0) * (x1 - x0);
      out[target] = a ? Math.round(r / a) : 0;
      out[target + 1] = a ? Math.round(g / a) : 0;
      out[target + 2] = a ? Math.round(b / a) : 0;
      out[target + 3] = Math.round(a / count);
    }
  }
  return { width, height, data: out };
}

/**
 * Shrinks a PNG or JPEG so neither side exceeds `maxDimension`, keeping the
 * aspect ratio and the format. Returns `undefined` when the image already
 * fits, or when its format can't be decoded here.
 */
export function downscaleImage(
  bytes: Uint8Array,
  { maxDimension, jpegQuality = 85 }: { maxDimension: number; jpegQuality?: number },
): ResizedImage | undefined {
  const dimensions = readImageDimensions(bytes);
  if (!dimensions || (dimensions.width <= maxDimension && dimensions.height <= maxDimension)) return undefined;

  const scale = maxDimension / Math.max(dimensions.width, dimensions.height);
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));

  if (isPng(bytes)) {
    const decoded = decodePng(bytes);
    if (!decoded) return undefined;
    return { width, height, mediaType: 'image/png', data: encodePng(downsample(decoded, width, height)) };
  }

  let decoded: RgbaImage;
  try {
    const jpeg = decodeJpegBytes(bytes, { useTArray: true, formatAsRGBA: true });
    decoded = { width: jpeg.width, height: jpeg.height, data: jpeg.data };
  } catch {
    return undefined;
  }
  const resized = downsample(decoded, width, height);
  const encoded = encodeJpegBytes({ ...resized, data: Buffer.from(resized.data) }, jpegQuality);
  return { width, height, mediaType: 'image/jpeg', data: new Uint8Array(encoded.data) };
}
