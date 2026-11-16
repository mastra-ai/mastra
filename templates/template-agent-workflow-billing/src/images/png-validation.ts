import { inflateSync } from 'node:zlib';
import { BillingError } from '../billing/contracts/core.js';
export const maxImageBytes = 8 * 1024 * 1024;
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function validatePng(bytes: Buffer, expected?: { width: number; height: number }) {
  const invalid = () => {
    throw new BillingError('state_unavailable');
  };
  if (
    bytes.length < 57 ||
    bytes.length > maxImageBytes ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    invalid();
  let offset = 8,
    width = 0,
    height = 0,
    channels = 0,
    ended = false,
    dataStarted = false,
    dataEnded = false,
    chunks = 0,
    palette = false;
  const compressed: Buffer[] = [];
  while (offset < bytes.length) {
    if (++chunks > 4096) invalid();
    if (offset + 12 > bytes.length) invalid();
    const length = bytes.readUInt32BE(offset),
      end = offset + 12 + length;
    if (end > bytes.length) invalid();
    const kind = bytes.toString('latin1', offset + 4, offset + 8),
      data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid();
    if (!/^[A-Za-z]{4}$/.test(kind) || (offset === 8 && kind !== 'IHDR')) invalid();
    if (kind === 'IHDR') {
      if (offset !== 8 || length !== 13) invalid();
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[data[9]] ?? 0;
      if (
        !([1024, 1536].includes(width) && [1024, 1536].includes(height) && (width === 1024 || height === 1024)) ||
        (expected && (width !== expected.width || height !== expected.height)) ||
        data[8] !== 8 ||
        !channels ||
        data[10] ||
        data[11] ||
        data[12]
      )
        invalid();
    } else if (kind === 'IDAT') {
      if (dataEnded) invalid();
      dataStarted = true;
      compressed.push(data);
    } else if (kind === 'IEND') {
      if (length || !dataStarted || end !== bytes.length) invalid();
      ended = true;
    } else {
      if (dataStarted) dataEnded = true;
      if (kind === 'PLTE') {
        if (palette || dataStarted || !length || length > 768 || length % 3 !== 0) invalid();
        palette = true;
      } else if ((bytes[offset + 4] & 32) === 0) invalid();
    }
    offset = end;
  }
  if (!ended) invalid();
  try {
    const row = width * channels + 1,
      raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: row * height });
    if (raw.length !== row * height) invalid();
    for (let y = 0; y < height; y++) if (raw[y * row] > 4) invalid();
  } catch {
    invalid();
  }
  return { width, height };
}
