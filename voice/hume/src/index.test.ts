import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { HumeVoice } from './index';

describe('HumeVoice', () => {
  describe('constructor', () => {
    it('should throw when no API key is provided', () => {
      const originalKey = process.env.HUME_API_KEY;
      delete process.env.HUME_API_KEY;

      expect(
        () =>
          new HumeVoice({
            speechModel: {},
          }),
      ).toThrow('HUME_API_KEY is not set');

      if (originalKey !== undefined) {
        process.env.HUME_API_KEY = originalKey;
      }
    });

    it('should accept apiKey from speechModel config', () => {
      const voice = new HumeVoice({
        speechModel: { apiKey: 'test-key' },
        speaker: 'test-voice',
      });
      expect(voice).toBeInstanceOf(HumeVoice);
    });
  });

  describe('getListener', () => {
    it('should return enabled: false', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      const result = await voice.getListener();
      expect(result).toEqual({ enabled: false });
    });
  });

  describe('listen', () => {
    it('should throw as Hume does not support speech recognition', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      const audioStream = Readable.from(Buffer.from('dummy audio'));

      await expect(voice.listen(audioStream)).rejects.toThrow('Hume does not support speech recognition');
    });
  });

  describe('error handling', () => {
    it('should handle empty text', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });

    it('should handle whitespace-only text', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      await expect(voice.speak('   \n\t  ')).rejects.toThrow('Input text is empty');
    });
  });
});
