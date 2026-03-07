import { describe, it, expect } from 'vitest';
import { detectMediaType, imageMediaTypeSignatures, audioMediaTypeSignatures, videoMediaTypeSignatures } from './media';

describe('detectMediaType', () => {
  describe('image signatures', () => {
    it('detects PNG from bytes', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectMediaType({ data: png, signatures: imageMediaTypeSignatures })).toBe('image/png');
    });

    it('detects JPEG from bytes', () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectMediaType({ data: jpeg, signatures: imageMediaTypeSignatures })).toBe('image/jpeg');
    });

    it('detects GIF from base64', () => {
      expect(detectMediaType({ data: 'R0lGODlhAQABAIAAAAAAAP', signatures: imageMediaTypeSignatures })).toBe(
        'image/gif',
      );
    });

    it('returns undefined for non-image data', () => {
      const random = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      expect(detectMediaType({ data: random, signatures: imageMediaTypeSignatures })).toBeUndefined();
    });
  });

  describe('audio signatures', () => {
    it('detects WAV from bytes', () => {
      const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
      expect(detectMediaType({ data: wav, signatures: audioMediaTypeSignatures })).toBe('audio/wav');
    });

    it('detects OGG from bytes', () => {
      const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00]);
      expect(detectMediaType({ data: ogg, signatures: audioMediaTypeSignatures })).toBe('audio/ogg');
    });

    it('detects FLAC from base64', () => {
      expect(detectMediaType({ data: 'ZkxhQwAAACIA', signatures: audioMediaTypeSignatures })).toBe('audio/flac');
    });
  });

  describe('video signatures', () => {
    it('detects WebM from bytes', () => {
      const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00]);
      expect(detectMediaType({ data: webm, signatures: videoMediaTypeSignatures })).toBe('video/webm');
    });

    it('detects WebM from base64', () => {
      expect(detectMediaType({ data: 'GkXfowEAAA', signatures: videoMediaTypeSignatures })).toBe('video/webm');
    });

    it('detects FLV from bytes', () => {
      const flv = new Uint8Array([0x46, 0x4c, 0x56, 0x01, 0x05]);
      expect(detectMediaType({ data: flv, signatures: videoMediaTypeSignatures })).toBe('video/x-flv');
    });

    it('detects FLV from base64', () => {
      expect(detectMediaType({ data: 'RkxWAQUAAA', signatures: videoMediaTypeSignatures })).toBe('video/x-flv');
    });

    it('detects MPEG-PS from bytes', () => {
      const mpeg = new Uint8Array([0x00, 0x00, 0x01, 0xba, 0x44]);
      expect(detectMediaType({ data: mpeg, signatures: videoMediaTypeSignatures })).toBe('video/mpeg');
    });

    it('detects MP4 with isom brand (ftyp box size 24)', () => {
      // 00 00 00 18 66 74 79 70 69 73 6f 6d
      const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00]);
      expect(detectMediaType({ data: mp4, signatures: videoMediaTypeSignatures })).toBe('video/mp4');
    });

    it('detects MP4 with isom brand (ftyp box size 28)', () => {
      const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00]);
      expect(detectMediaType({ data: mp4, signatures: videoMediaTypeSignatures })).toBe('video/mp4');
    });

    it('detects MP4 with isom brand (ftyp box size 32)', () => {
      const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00]);
      expect(detectMediaType({ data: mp4, signatures: videoMediaTypeSignatures })).toBe('video/mp4');
    });

    it('detects MP4 with isom brand from base64', () => {
      expect(detectMediaType({ data: 'AAAAIGZ0eXBpc29tAAAAAA', signatures: videoMediaTypeSignatures })).toBe(
        'video/mp4',
      );
    });

    it('detects MP4 with mp41 brand', () => {
      const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x31, 0x00]);
      expect(detectMediaType({ data: mp4, signatures: videoMediaTypeSignatures })).toBe('video/mp4');
    });

    it('detects MP4 with mp42 brand', () => {
      const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00]);
      expect(detectMediaType({ data: mp4, signatures: videoMediaTypeSignatures })).toBe('video/mp4');
    });

    it('detects QuickTime with qt brand', () => {
      const qt = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0x00]);
      expect(detectMediaType({ data: qt, signatures: videoMediaTypeSignatures })).toBe('video/quicktime');
    });

    it('detects 3GPP with 3gp4 brand', () => {
      const gpp = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70, 0x34, 0x00]);
      expect(detectMediaType({ data: gpp, signatures: videoMediaTypeSignatures })).toBe('video/3gpp');
    });

    it('detects 3GPP with 3gp5 brand', () => {
      const gpp = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70, 0x35, 0x00]);
      expect(detectMediaType({ data: gpp, signatures: videoMediaTypeSignatures })).toBe('video/3gpp');
    });

    it('returns undefined for non-video data', () => {
      const random = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      expect(detectMediaType({ data: random, signatures: videoMediaTypeSignatures })).toBeUndefined();
    });

    it('returns undefined for empty data', () => {
      const empty = new Uint8Array([]);
      expect(detectMediaType({ data: empty, signatures: videoMediaTypeSignatures })).toBeUndefined();
    });

    it('returns undefined for data shorter than signature', () => {
      const short = new Uint8Array([0x1a, 0x45]);
      expect(detectMediaType({ data: short, signatures: videoMediaTypeSignatures })).toBeUndefined();
    });
  });
});
