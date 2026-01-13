import { describe, expect, it } from 'vitest';

import { alawToPcm, convertAudio, mulawToPcm, pcmToAlaw, pcmToMulaw } from './audio-codecs';

describe('Audio Codecs', () => {
  describe('wrapper functions', () => {
    it('should return Int16Array from mulaw input', () => {
      const mulaw = Buffer.from([0xff, 0xff, 0x00, 0x80]);
      const pcm = mulawToPcm(mulaw);

      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
    });

    it('should return Buffer from PCM input (mulaw)', () => {
      const pcm = new Int16Array([0, 1000, -1000, 32767]);
      const mulaw = pcmToMulaw(pcm);

      expect(mulaw).toBeInstanceOf(Buffer);
      expect(mulaw.length).toBe(4);
    });

    it('should return Int16Array from alaw input', () => {
      const alaw = Buffer.from([0xd5, 0x55, 0xaa, 0x2a]);
      const pcm = alawToPcm(alaw);

      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
    });

    it('should return Buffer from PCM input (alaw)', () => {
      const pcm = new Int16Array([0, 1000, -1000, 32767]);
      const alaw = pcmToAlaw(pcm);

      expect(alaw).toBeInstanceOf(Buffer);
      expect(alaw.length).toBe(4);
    });

    it('should handle empty input', () => {
      expect(mulawToPcm(Buffer.from([])).length).toBe(0);
      expect(pcmToMulaw(new Int16Array([])).length).toBe(0);
      expect(alawToPcm(Buffer.from([])).length).toBe(0);
      expect(pcmToAlaw(new Int16Array([])).length).toBe(0);
    });
  });

  describe('convertAudio routing', () => {
    it('should return same reference when codecs match', () => {
      const pcm = new Int16Array([1, 2, 3, 4]);
      expect(convertAudio(pcm, 'pcm', 'pcm')).toBe(pcm);

      const mulaw = Buffer.from([1, 2, 3, 4]);
      expect(convertAudio(mulaw, 'mulaw', 'mulaw')).toBe(mulaw);

      const alaw = Buffer.from([1, 2, 3, 4]);
      expect(convertAudio(alaw, 'alaw', 'alaw')).toBe(alaw);
    });

    it('should convert mulaw to pcm', () => {
      const mulaw = Buffer.from([0xff, 0x00]);
      const result = convertAudio(mulaw, 'mulaw', 'pcm');

      expect(result).toBeInstanceOf(Int16Array);
      expect(result.length).toBe(2);
    });

    it('should convert pcm to mulaw', () => {
      const pcm = new Int16Array([0, 1000]);
      const result = convertAudio(pcm, 'pcm', 'mulaw');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(2);
    });

    it('should convert alaw to pcm', () => {
      const alaw = Buffer.from([0xd5, 0x55]);
      const result = convertAudio(alaw, 'alaw', 'pcm');

      expect(result).toBeInstanceOf(Int16Array);
      expect(result.length).toBe(2);
    });

    it('should convert pcm to alaw', () => {
      const pcm = new Int16Array([0, 1000]);
      const result = convertAudio(pcm, 'pcm', 'alaw');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(2);
    });

    it('should route mulaw to alaw through pcm', () => {
      const mulaw = Buffer.from([0xff, 0x00, 0x7f, 0x80]);
      const result = convertAudio(mulaw, 'mulaw', 'alaw');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(4);
    });

    it('should route alaw to mulaw through pcm', () => {
      const alaw = Buffer.from([0xd5, 0x55, 0xaa, 0x2a]);
      const result = convertAudio(alaw, 'alaw', 'mulaw');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(4);
    });
  });
});
