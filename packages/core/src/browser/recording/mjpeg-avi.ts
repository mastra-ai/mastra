/**
 * Pure-JS Motion-JPEG AVI muxer.
 *
 * Writes a list of JPEG frames into an AVI 1.0 container so that the resulting
 * `.avi` file plays in QuickTime / Preview / VLC / Chromium without depending
 * on ffmpeg or any native module.
 *
 * Implements the bare minimum of the RIFF/AVI spec needed for an MJPEG video
 * stream with no audio. All fields are little-endian.
 *
 * Reference: https://learn.microsoft.com/en-us/windows/win32/directshow/avi-riff-file-reference
 */

import { closeSync, fstatSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

/** A single MJPEG frame to mux. */
export interface MjpegFrame {
  /** JPEG bytes (must start with the SOI marker 0xFF 0xD8). */
  bytes: Uint8Array;
  /** Milliseconds since recording start. Used to compute the average frame rate. */
  timestampMs: number;
}

export interface MjpegAviOptions {
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
}

const FOURCC_RIFF = fourcc('RIFF');
const FOURCC_AVI = fourcc('AVI ');
const FOURCC_LIST = fourcc('LIST');
const FOURCC_HDRL = fourcc('hdrl');
const FOURCC_AVIH = fourcc('avih');
const FOURCC_STRL = fourcc('strl');
const FOURCC_STRH = fourcc('strh');
const FOURCC_STRF = fourcc('strf');
const FOURCC_VIDS = fourcc('vids');
const FOURCC_MJPG = fourcc('MJPG');
const FOURCC_MOVI = fourcc('movi');
const FOURCC_IDX1 = fourcc('idx1');
const FOURCC_00DC = fourcc('00dc');

const AVIF_HASINDEX = 0x00000010;
const AVIIF_KEYFRAME = 0x00000010;

const AVIH_SIZE = 56;
const STRH_SIZE = 56;
const STRF_SIZE = 40; // BITMAPINFOHEADER, no extra data
const LIST_TYPE_SIZE = 4; // 4 bytes for the LIST type ("hdrl", "movi", etc.)
const CHUNK_HEADER_SIZE = 8; // fourcc (4) + size (4)
const MAX_U32 = 0xffffffff;
const MAX_I16 = 0x7fff;

function fourcc(s: string): Buffer {
  if (s.length !== 4) {
    throw new Error(`fourcc must be 4 ASCII characters, got "${s}"`);
  }
  return Buffer.from(s, 'ascii');
}

/**
 * Encode a list of MJPEG frames as an AVI 1.0 file.
 *
 * The file is written incrementally to disk so we don't have to hold the whole
 * AVI in memory — large recordings can be hundreds of MB.
 */
export function writeMjpegAviFile(filePath: string, frames: readonly MjpegFrame[], opts: MjpegAviOptions): void {
  if (frames.length === 0) {
    throw new Error('writeMjpegAviFile: at least one frame is required');
  }
  if (opts.width <= 0 || opts.height <= 0 || !Number.isInteger(opts.width) || !Number.isInteger(opts.height)) {
    throw new Error(`writeMjpegAviFile: invalid dimensions ${opts.width}x${opts.height}`);
  }
  if (opts.width > MAX_I16 || opts.height > MAX_I16) {
    throw new Error(`writeMjpegAviFile: dimensions exceed AVI header bounds: ${opts.width}x${opts.height}`);
  }
  for (let i = 0; i < frames.length; i++) {
    assertJpegFrame(frames[i]!.bytes, i);
  }

  mkdirSync(dirname(filePath), { recursive: true });

  // Frame rate: derived from the elapsed time between the first and last
  // captured frames. AVI's main header stores a single dwMicroSecPerFrame, so
  // playback is even-paced; that matches MJPEG's typical usage.
  const elapsedMs =
    frames.length > 1 ? Math.max(1, frames[frames.length - 1]!.timestampMs - frames[0]!.timestampMs) : 1000;
  const fps = Math.max(1, Math.min(120, Math.round((frames.length * 1000) / elapsedMs)));
  const microSecPerFrame = Math.round(1_000_000 / fps);

  const maxFrameLen = frames.reduce((m, f) => Math.max(m, f.bytes.length), 0);
  assertU32(maxFrameLen, 'max frame length');
  const totalFrameBytes = frames.reduce((sum, f) => sum + CHUNK_HEADER_SIZE + paddedLength(f.bytes.length), 0);
  assertU32(totalFrameBytes, 'total frame bytes');

  // -------------------------------------------------------------------------
  // Pre-compute header bytes
  // -------------------------------------------------------------------------

  const hdrl = buildHdrl({
    width: opts.width,
    height: opts.height,
    microSecPerFrame,
    totalFrames: frames.length,
    maxFrameLen,
  });

  // movi list size: 4 bytes for the "movi" type fourcc + all frame chunks.
  const moviPayloadSize = LIST_TYPE_SIZE + totalFrameBytes;
  assertU32(moviPayloadSize, 'movi list size');
  // idx1 chunk size: 16 bytes per entry.
  const idx1PayloadSize = frames.length * 16;
  assertU32(idx1PayloadSize, 'idx1 chunk size');

  // RIFF payload size = 4 ("AVI ") + hdrl LIST (header+size+payload) +
  //                     movi LIST (header+size+payload) + idx1 chunk (header+payload)
  const riffPayloadSize =
    4 + CHUNK_HEADER_SIZE + hdrl.length + CHUNK_HEADER_SIZE + moviPayloadSize + CHUNK_HEADER_SIZE + idx1PayloadSize;
  assertU32(riffPayloadSize, 'RIFF payload size');

  // -------------------------------------------------------------------------
  // Write the file
  // -------------------------------------------------------------------------

  const fd = openSync(filePath, 'w');
  try {
    // RIFF header
    writeFourCC(fd, FOURCC_RIFF);
    writeU32(fd, riffPayloadSize);
    writeFourCC(fd, FOURCC_AVI);

    // hdrl LIST
    writeFourCC(fd, FOURCC_LIST);
    writeU32(fd, hdrl.length);
    writeBuffer(fd, hdrl);

    // movi LIST
    writeFourCC(fd, FOURCC_LIST);
    writeU32(fd, moviPayloadSize);
    writeFourCC(fd, FOURCC_MOVI);

    // Track per-frame offsets relative to the start of the "movi" type fourcc
    // (i.e. offset 0 == the "movi" tag itself). This is the convention most
    // AVI parsers expect for idx1.
    const moviStartOffset = currentOffset(fd) - LIST_TYPE_SIZE;
    const frameOffsets: number[] = [];

    for (const frame of frames) {
      const offset = currentOffset(fd) - moviStartOffset;
      frameOffsets.push(offset);
      writeFourCC(fd, FOURCC_00DC);
      writeU32(fd, frame.bytes.length);
      writeBuffer(fd, Buffer.from(frame.bytes.buffer, frame.bytes.byteOffset, frame.bytes.byteLength));
      // Chunks are word-aligned: pad odd-length chunks with a zero byte.
      if (frame.bytes.length % 2 === 1) {
        writeBuffer(fd, Buffer.from([0]));
      }
    }

    // idx1 chunk
    writeFourCC(fd, FOURCC_IDX1);
    writeU32(fd, idx1PayloadSize);
    const idx1 = Buffer.alloc(idx1PayloadSize);
    for (let i = 0; i < frames.length; i++) {
      const base = i * 16;
      FOURCC_00DC.copy(idx1, base);
      idx1.writeUInt32LE(AVIIF_KEYFRAME, base + 4);
      idx1.writeUInt32LE(frameOffsets[i]!, base + 8);
      idx1.writeUInt32LE(frames[i]!.bytes.length, base + 12);
    }
    writeBuffer(fd, idx1);
  } finally {
    closeSync(fd);
  }
}

/** Build the contents of the hdrl LIST (without the leading LIST/size/hdrl tag). */
function buildHdrl(args: {
  width: number;
  height: number;
  microSecPerFrame: number;
  totalFrames: number;
  maxFrameLen: number;
}): Buffer {
  const { width, height, microSecPerFrame, totalFrames, maxFrameLen } = args;
  assertU32(microSecPerFrame, 'microseconds per frame');
  assertU32(totalFrames, 'total frames');
  assertU32(maxFrameLen, 'max frame length');
  const maxBytesPerSec = Math.round((maxFrameLen * 1_000_000) / microSecPerFrame);
  assertU32(maxBytesPerSec, 'max bytes per second');
  const sizeImage = width * height * 3;
  assertU32(sizeImage, 'bitmap image size');

  // Inner size:
  //   "hdrl" (4) + avih chunk header (8) + avih payload (56)
  //     + strl LIST tag (4) + LIST size (4) + "strl" (4)
  //       + strh chunk header (8) + strh payload (56)
  //       + strf chunk header (8) + strf payload (40)
  const strlPayloadSize = LIST_TYPE_SIZE + CHUNK_HEADER_SIZE + STRH_SIZE + CHUNK_HEADER_SIZE + STRF_SIZE;
  const hdrlPayloadSize = LIST_TYPE_SIZE + CHUNK_HEADER_SIZE + AVIH_SIZE + CHUNK_HEADER_SIZE + strlPayloadSize;
  const buf = Buffer.alloc(hdrlPayloadSize);

  let p = 0;
  FOURCC_HDRL.copy(buf, p);
  p += 4;

  // avih chunk
  FOURCC_AVIH.copy(buf, p);
  p += 4;
  buf.writeUInt32LE(AVIH_SIZE, p);
  p += 4;
  // dwMicroSecPerFrame
  buf.writeUInt32LE(microSecPerFrame, p);
  p += 4;
  // dwMaxBytesPerSec
  buf.writeUInt32LE(maxBytesPerSec, p);
  p += 4;
  // dwPaddingGranularity
  buf.writeUInt32LE(0, p);
  p += 4;
  // dwFlags
  buf.writeUInt32LE(AVIF_HASINDEX, p);
  p += 4;
  // dwTotalFrames
  buf.writeUInt32LE(totalFrames, p);
  p += 4;
  // dwInitialFrames
  buf.writeUInt32LE(0, p);
  p += 4;
  // dwStreams
  buf.writeUInt32LE(1, p);
  p += 4;
  // dwSuggestedBufferSize
  buf.writeUInt32LE(maxFrameLen, p);
  p += 4;
  // dwWidth, dwHeight
  buf.writeUInt32LE(width, p);
  p += 4;
  buf.writeUInt32LE(height, p);
  p += 4;
  // dwReserved[4]
  p += 16;

  // strl LIST
  FOURCC_LIST.copy(buf, p);
  p += 4;
  buf.writeUInt32LE(strlPayloadSize, p);
  p += 4;
  FOURCC_STRL.copy(buf, p);
  p += 4;

  // strh chunk
  FOURCC_STRH.copy(buf, p);
  p += 4;
  buf.writeUInt32LE(STRH_SIZE, p);
  p += 4;
  FOURCC_VIDS.copy(buf, p);
  p += 4; // fccType
  FOURCC_MJPG.copy(buf, p);
  p += 4; // fccHandler
  // dwFlags, wPriority, wLanguage, dwInitialFrames
  buf.writeUInt32LE(0, p);
  p += 4;
  buf.writeUInt16LE(0, p);
  p += 2;
  buf.writeUInt16LE(0, p);
  p += 2;
  buf.writeUInt32LE(0, p);
  p += 4;
  // dwScale, dwRate -> rate/scale = fps
  buf.writeUInt32LE(microSecPerFrame, p);
  p += 4;
  buf.writeUInt32LE(1_000_000, p);
  p += 4;
  // dwStart
  buf.writeUInt32LE(0, p);
  p += 4;
  // dwLength (frames)
  buf.writeUInt32LE(totalFrames, p);
  p += 4;
  // dwSuggestedBufferSize
  buf.writeUInt32LE(maxFrameLen, p);
  p += 4;
  // dwQuality (-1 == default)
  buf.writeInt32LE(-1, p);
  p += 4;
  // dwSampleSize
  buf.writeUInt32LE(0, p);
  p += 4;
  // rcFrame (left, top, right, bottom) as 16-bit ints
  buf.writeInt16LE(0, p);
  p += 2;
  buf.writeInt16LE(0, p);
  p += 2;
  buf.writeInt16LE(width, p);
  p += 2;
  buf.writeInt16LE(height, p);
  p += 2;

  // strf chunk (BITMAPINFOHEADER for MJPG)
  FOURCC_STRF.copy(buf, p);
  p += 4;
  buf.writeUInt32LE(STRF_SIZE, p);
  p += 4;
  // biSize
  buf.writeUInt32LE(STRF_SIZE, p);
  p += 4;
  // biWidth, biHeight
  buf.writeInt32LE(width, p);
  p += 4;
  buf.writeInt32LE(height, p);
  p += 4;
  // biPlanes, biBitCount
  buf.writeUInt16LE(1, p);
  p += 2;
  buf.writeUInt16LE(24, p);
  p += 2;
  // biCompression = "MJPG"
  FOURCC_MJPG.copy(buf, p);
  p += 4;
  // biSizeImage
  buf.writeUInt32LE(sizeImage, p);
  p += 4;
  // biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant
  buf.writeInt32LE(0, p);
  p += 4;
  buf.writeInt32LE(0, p);
  p += 4;
  buf.writeUInt32LE(0, p);
  p += 4;
  buf.writeUInt32LE(0, p);
  p += 4;

  if (p !== hdrlPayloadSize) {
    throw new Error(`buildHdrl internal error: wrote ${p} bytes, expected ${hdrlPayloadSize}`);
  }
  return buf;
}

function paddedLength(n: number): number {
  return n + (n & 1);
}

function assertJpegFrame(bytes: Uint8Array, index: number): void {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error(`writeMjpegAviFile: frame ${index} is not a JPEG frame (missing SOI marker)`);
  }
}

function assertU32(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_U32) {
    throw new Error(`writeMjpegAviFile: ${field} exceeds 32-bit AVI limit (${value})`);
  }
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

const u32buf = Buffer.alloc(4);

function writeFourCC(fd: number, fc: Buffer): void {
  writeSync(fd, fc, 0, 4);
}

function writeU32(fd: number, value: number): void {
  assertU32(value, 'uint32 field');
  u32buf.writeUInt32LE(value, 0);
  writeSync(fd, u32buf, 0, 4);
}

function writeBuffer(fd: number, buf: Buffer): void {
  writeSync(fd, buf, 0, buf.length);
}

function currentOffset(fd: number): number {
  return fstatSync(fd).size;
}
