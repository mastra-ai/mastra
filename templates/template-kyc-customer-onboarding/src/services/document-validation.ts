import { z } from 'zod';
import { inflateSync } from 'node:zlib';

import { DocumentUploadError } from '../domain/errors.js';

export const maximumDocumentSizeBytes = 10 * 1024 * 1024;
export const maximumDecodedPngSizeBytes = 32 * 1024 * 1024;

export const supportedDocumentMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'application/pdf']);

export const validatedDocumentUploadSchema = z
  .object({
    mimeType: supportedDocumentMimeTypeSchema,
    bytes: z.instanceof(Uint8Array),
    sizeBytes: z.number().int().positive(),
    pageCount: z.number().int().positive().nullable(),
  })
  .strict();

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const hasPrefix = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((value, index) => bytes[index] === value);

const sniffMimeType = (bytes: Uint8Array): z.infer<typeof supportedDocumentMimeTypeSchema> | null => {
  if (hasPrefix(bytes, pngSignature)) return 'image/png';
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') return 'application/pdf';
  return null;
};

const invalidDocument = (message: string): never => {
  throw new DocumentUploadError('DOCUMENT_CONTENT_INVALID', message);
};

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const validatePng = (bytes: Uint8Array): void => {
  if (bytes.byteLength < 45) invalidDocument('The PNG document is truncated');
  let offset = pngSignature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let sawHeader = false;
  let sawData = false;
  let sawEnd = false;
  const compressedParts: Uint8Array[] = [];
  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength) invalidDocument('The PNG chunk framing is invalid');
    const length = readUint32(bytes, offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.byteLength) invalidDocument('The PNG chunk is truncated');
    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const type = new TextDecoder('ascii').decode(typeBytes);
    if (!/^[A-Za-z]{4}$/u.test(type)) invalidDocument('The PNG chunk type is invalid');
    const data = bytes.slice(offset + 8, offset + 8 + length);
    const expectedCrc = readUint32(bytes, offset + 8 + length);
    const crcInput = new Uint8Array(typeBytes.byteLength + data.byteLength);
    crcInput.set(typeBytes);
    crcInput.set(data, typeBytes.byteLength);
    if (crc32(crcInput) !== expectedCrc) invalidDocument('The PNG chunk checksum is invalid');
    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13) invalidDocument('The PNG header is invalid');
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? -1;
      if (width === 0 || height === 0 || width > 20_000 || height > 20_000)
        invalidDocument('The PNG dimensions are invalid');
      if ((data[10] ?? -1) !== 0 || (data[11] ?? -1) !== 0 || (data[12] ?? -1) !== 0)
        invalidDocument('The PNG encoding is not supported');
      sawHeader = true;
    } else if (type === 'IHDR') {
      invalidDocument('The PNG contains multiple headers');
    }
    if (type === 'IDAT') {
      if (length === 0) invalidDocument('The PNG image data is empty');
      compressedParts.push(data);
      sawData = true;
    }
    if (type === 'IEND') {
      if (length !== 0 || !sawData || chunkEnd !== bytes.byteLength) invalidDocument('The PNG end marker is invalid');
      sawEnd = true;
    }
    offset = chunkEnd;
    if (sawEnd) break;
  }
  if (!sawHeader || !sawData || !sawEnd) invalidDocument('The PNG structure is incomplete');
  const channels = new Map([
    [0, 1],
    [2, 3],
    [3, 1],
    [4, 2],
    [6, 4],
  ]).get(colorType);
  if (channels === undefined)
    throw new DocumentUploadError('DOCUMENT_CONTENT_INVALID', 'The PNG pixel format is not supported');
  if (![1, 2, 4, 8, 16].includes(bitDepth)) invalidDocument('The PNG bit depth is not supported');
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const decodedSizeBytes = (rowBytes + 1) * height;
  if (!Number.isSafeInteger(decodedSizeBytes) || decodedSizeBytes > maximumDecodedPngSizeBytes)
    invalidDocument('The decoded PNG exceeds the processing limit');
  const compressed = new Uint8Array(compressedParts.reduce((sum, part) => sum + part.byteLength, 0));
  let compressedOffset = 0;
  for (const part of compressedParts) {
    compressed.set(part, compressedOffset);
    compressedOffset += part.byteLength;
  }
  try {
    const decoded = inflateSync(compressed, { maxOutputLength: decodedSizeBytes });
    if (decoded.byteLength !== decodedSizeBytes) invalidDocument('The PNG pixel data length is invalid');
    for (let row = 0; row < height; row += 1) {
      if ((decoded[row * (rowBytes + 1)] ?? 5) > 4) invalidDocument('The PNG row filter is invalid');
    }
  } catch (error) {
    if (error instanceof DocumentUploadError) throw error;
    invalidDocument('The PNG image data cannot be decoded');
  }
};

const validateJpeg = (bytes: Uint8Array): void => {
  if (bytes.byteLength < 16 || !hasPrefix(bytes, [0xff, 0xd8])) invalidDocument('The JPEG document is truncated');
  let offset = 2;
  let sawFrame = false;
  let sawScan = false;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) invalidDocument('The JPEG marker framing is invalid');
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined) throw new DocumentUploadError('DOCUMENT_CONTENT_INVALID', 'The JPEG marker is missing');
    if (marker === 0x00) invalidDocument('The JPEG marker is invalid');
    if (marker === 0xd9) {
      if (!sawFrame || !sawScan || offset !== bytes.byteLength) invalidDocument('The JPEG end marker is invalid');
      return;
    }
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.byteLength) invalidDocument('The JPEG segment is truncated');
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.byteLength) invalidDocument('The JPEG segment length is invalid');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) invalidDocument('The JPEG frame is invalid');
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      if (width === 0 || height === 0) invalidDocument('The JPEG dimensions are invalid');
      sawFrame = true;
    }
    if (marker === 0xda) {
      sawScan = true;
      offset += length;
      while (offset < bytes.byteLength) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const next = bytes[offset + 1];
        if (next === 0x00 || (next !== undefined && next >= 0xd0 && next <= 0xd7)) {
          offset += 2;
          continue;
        }
        break;
      }
      continue;
    }
    offset += length;
  }
  invalidDocument('The JPEG structure is incomplete');
};

const validatePdf = (bytes: Uint8Array): number => {
  const source = new TextDecoder('latin1').decode(bytes);
  if (!/^%PDF-1\.[0-7]\r?\n/u.test(source) || !/%%EOF\s*$/u.test(source)) {
    throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF structure is invalid');
  }
  if (/\/Encrypt\b/u.test(source)) {
    throw new DocumentUploadError('DOCUMENT_PDF_ENCRYPTED', 'Encrypted PDFs are not supported');
  }
  const startXrefMatch = /startxref\s+(\d+)\s+%%EOF\s*$/u.exec(source);
  if (startXrefMatch === null) {
    throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF cross-reference is missing');
  }
  const xrefOffset = Number(startXrefMatch[1]);
  if (!Number.isSafeInteger(xrefOffset) || source.slice(xrefOffset, xrefOffset + 5) !== 'xref\n') {
    throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF cross-reference is invalid');
  }
  const xrefSection = source.slice(xrefOffset, startXrefMatch.index);
  const xrefMatch = /^xref\r?\n0 (\d+)\r?\n([\s\S]+?)\r?\ntrailer\r?\n<<([\s\S]+?)>>\r?\n$/u.exec(xrefSection);
  if (xrefMatch === null) {
    throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF cross-reference is invalid');
  }
  const objectCount = Number(xrefMatch[1]);
  const entries = (xrefMatch[2] ?? '').split(/\r?\n/u);
  if (objectCount < 2 || entries.length !== objectCount || !/\/Root\s+1\s+0\s+R\b/u.test(xrefMatch[3] ?? '')) {
    throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF trailer is invalid');
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = /^(\d{10}) (\d{5}) ([fn])\s?$/u.exec(entries[index] ?? '');
    if (entry === null) {
      throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF cross-reference is invalid');
    }
    if (index === 0) continue;
    const objectOffset = Number(entry[1]);
    if (entry[3] !== 'n' || !source.startsWith(`${String(index)} 0 obj`, objectOffset)) {
      throw new DocumentUploadError('DOCUMENT_PDF_INVALID', 'The PDF object offset is invalid');
    }
  }
  const pageCount = [...source.matchAll(/\/Type\s*\/Page(?!s)\b/gu)].length;
  if (pageCount < 1 || pageCount > 3) {
    throw new DocumentUploadError('DOCUMENT_PDF_PAGE_LIMIT', 'PDF documents must contain between one and three pages');
  }
  return pageCount;
};

export const validateDocumentUpload = (
  input: Readonly<{
    declaredMimeType: string;
    bytes: Uint8Array;
    maximumSizeBytes?: number;
  }>,
): z.infer<typeof validatedDocumentUploadSchema> => {
  const maximumSizeBytes = input.maximumSizeBytes ?? maximumDocumentSizeBytes;
  if (input.bytes.byteLength === 0) {
    throw new DocumentUploadError('DOCUMENT_EMPTY', 'The document is empty');
  }
  if (input.bytes.byteLength > maximumSizeBytes) {
    throw new DocumentUploadError('DOCUMENT_TOO_LARGE', 'The document exceeds the upload limit');
  }
  const declared = supportedDocumentMimeTypeSchema.safeParse(input.declaredMimeType);
  if (!declared.success) {
    throw new DocumentUploadError('DOCUMENT_MIME_UNSUPPORTED', 'The document MIME type is not supported');
  }
  const detected = sniffMimeType(input.bytes);
  if (detected === null || detected !== declared.data) {
    throw new DocumentUploadError(
      'DOCUMENT_MIME_MISMATCH',
      'The document content does not match its declared MIME type',
    );
  }
  const pageCount = detected === 'application/pdf' ? validatePdf(input.bytes) : null;
  if (detected === 'image/png') validatePng(input.bytes);
  if (detected === 'image/jpeg') validateJpeg(input.bytes);
  return validatedDocumentUploadSchema.parse({
    mimeType: detected,
    bytes: input.bytes,
    sizeBytes: input.bytes.byteLength,
    pageCount,
  });
};
