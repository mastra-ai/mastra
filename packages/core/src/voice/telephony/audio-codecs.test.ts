import { describe, expect, it } from 'vitest';

import { alawToPcm, convertAudio, mulawToPcm, pcmToAlaw, pcmToMulaw } from './audio-codecs';

describe('Audio Codecs', () => {
  describe('mulawToPcm', () => {
    it('should convert μ-law to PCM', () => {
      // μ-law silence is typically 0xFF (255)
      const mulawSilence = Buffer.from([0xff, 0xff, 0xff, 0xff]);
      const pcm = mulawToPcm(mulawSilence);

      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
      // Silence should decode to 0 or near-zero values
      for (const sample of pcm) {
        expect(Math.abs(sample)).toBeLessThan(100);
      }
    });

    it('should convert μ-law audio samples', () => {
      // Test with some known μ-law values
      const mulaw = Buffer.from([0x00, 0x7f, 0x80, 0xff]);
      const pcm = mulawToPcm(mulaw);

      expect(pcm.length).toBe(4);
      // 0x00 decodes to a large negative value
      expect(pcm[0]).toBeLessThan(0);
      // 0x7f decodes to a small value near zero
      // 0x80 decodes to a large positive value
      expect(pcm[2]).toBeGreaterThan(0);
      // 0xff decodes to near zero
    });

    it('should handle empty buffer', () => {
      const pcm = mulawToPcm(Buffer.from([]));
      expect(pcm.length).toBe(0);
    });
  });

  describe('pcmToMulaw', () => {
    it('should convert PCM to μ-law', () => {
      // PCM silence
      const pcmSilence = new Int16Array([0, 0, 0, 0]);
      const mulaw = pcmToMulaw(pcmSilence);

      expect(mulaw).toBeInstanceOf(Buffer);
      expect(mulaw.length).toBe(4);
      // Silence in μ-law should be 0xFF (255)
      for (const sample of mulaw) {
        expect(sample).toBe(0xff);
      }
    });

    it('should convert PCM samples', () => {
      const pcm = new Int16Array([0, 1000, -1000, 32767]);
      const mulaw = pcmToMulaw(pcm);

      expect(mulaw.length).toBe(4);
      // Silent sample (0) -> 0xFF
      expect(mulaw[0]).toBe(0xff);
      // Positive samples should have sign bit clear (MSB = 0)
      expect(mulaw[1]! & 0x80).toBe(0);
      // Negative samples should have sign bit set (MSB = 1)
      expect(mulaw[2]! & 0x80).toBe(0x80);
    });

    it('should handle empty array', () => {
      const mulaw = pcmToMulaw(new Int16Array([]));
      expect(mulaw.length).toBe(0);
    });

    it('should round-trip PCM -> μ-law -> PCM approximately', () => {
      // Note: μ-law is lossy, so we won't get exact values back
      const original = new Int16Array([0, 5000, -5000, 20000, -20000]);
      const mulaw = pcmToMulaw(original);
      const decoded = mulawToPcm(mulaw);

      expect(decoded.length).toBe(original.length);

      // Values should be approximately preserved (within ~3% of max range)
      const tolerance = 32768 * 0.03;
      for (let i = 0; i < original.length; i++) {
        expect(Math.abs(decoded[i]! - original[i]!)).toBeLessThan(tolerance);
      }
    });
  });

  describe('alawToPcm', () => {
    it('should convert A-law to PCM', () => {
      // A-law encoded samples
      const alaw = Buffer.from([0xd5, 0x55, 0xaa, 0x2a]);
      const pcm = alawToPcm(alaw);

      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
    });

    it('should handle empty buffer', () => {
      const pcm = alawToPcm(Buffer.from([]));
      expect(pcm.length).toBe(0);
    });
  });

  describe('pcmToAlaw', () => {
    it('should convert PCM to A-law', () => {
      const pcm = new Int16Array([0, 1000, -1000, 32767]);
      const alaw = pcmToAlaw(pcm);

      expect(alaw).toBeInstanceOf(Buffer);
      expect(alaw.length).toBe(4);
    });

    it('should handle empty array', () => {
      const alaw = pcmToAlaw(new Int16Array([]));
      expect(alaw.length).toBe(0);
    });

    it('should round-trip PCM -> A-law -> PCM approximately', () => {
      // Note: A-law is lossy
      const original = new Int16Array([0, 5000, -5000, 20000, -20000]);
      const alaw = pcmToAlaw(original);
      const decoded = alawToPcm(alaw);

      expect(decoded.length).toBe(original.length);

      // Values should be approximately preserved
      const tolerance = 32768 * 0.05;
      for (let i = 0; i < original.length; i++) {
        expect(Math.abs(decoded[i]! - original[i]!)).toBeLessThan(tolerance);
      }
    });
  });

  describe('convertAudio', () => {
    it('should return same data when codecs match', () => {
      const pcm = new Int16Array([1, 2, 3, 4]);
      const result = convertAudio(pcm, 'pcm', 'pcm');
      expect(result).toBe(pcm);

      const mulaw = Buffer.from([1, 2, 3, 4]);
      const mulawResult = convertAudio(mulaw, 'mulaw', 'mulaw');
      expect(mulawResult).toBe(mulaw);
    });

    it('should convert mulaw to pcm', () => {
      const mulaw = Buffer.from([0xff, 0x00, 0x7f, 0x80]);
      const pcm = convertAudio(mulaw, 'mulaw', 'pcm') as Int16Array;

      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
    });

    it('should convert pcm to mulaw', () => {
      const pcm = new Int16Array([0, 1000, -1000, 10000]);
      const mulaw = convertAudio(pcm, 'pcm', 'mulaw') as Buffer;

      expect(mulaw).toBeInstanceOf(Buffer);
      expect(mulaw.length).toBe(4);
    });

    it('should convert alaw to pcm', () => {
      const alaw = Buffer.from([0xd5, 0x55, 0xaa, 0x2a]);
      const pcm = convertAudio(alaw, 'alaw', 'pcm') as Int16Array;

      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
    });

    it('should convert pcm to alaw', () => {
      const pcm = new Int16Array([0, 1000, -1000, 10000]);
      const alaw = convertAudio(pcm, 'pcm', 'alaw') as Buffer;

      expect(alaw).toBeInstanceOf(Buffer);
      expect(alaw.length).toBe(4);
    });

    it('should convert mulaw to alaw via pcm', () => {
      const mulaw = Buffer.from([0xff, 0x00, 0x7f, 0x80]);
      const alaw = convertAudio(mulaw, 'mulaw', 'alaw') as Buffer;

      expect(alaw).toBeInstanceOf(Buffer);
      expect(alaw.length).toBe(4);
    });

    it('should convert alaw to mulaw via pcm', () => {
      const alaw = Buffer.from([0xd5, 0x55, 0xaa, 0x2a]);
      const mulaw = convertAudio(alaw, 'alaw', 'mulaw') as Buffer;

      expect(mulaw).toBeInstanceOf(Buffer);
      expect(mulaw.length).toBe(4);
    });
  });
});
