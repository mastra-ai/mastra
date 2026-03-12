import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HumeVoice } from './index';

describe('HumeVoice', () => {
  describe('constructor', () => {
    it('should throw when no API key is provided', () => {
      const originalKey = process.env.HUME_API_KEY;
      try {
        delete process.env.HUME_API_KEY;
        expect(
          () =>
            new HumeVoice({
              speechModel: {},
            }),
        ).toThrow('HUME_API_KEY is not set');
      } finally {
        if (originalKey !== undefined) {
          process.env.HUME_API_KEY = originalKey;
        }
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

  describe('getSpeakers', () => {
    it('should aggregate voices from multiple pages', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      const listSpy = vi.spyOn(voice['client'].tts.voices, 'list');
      listSpy
        .mockResolvedValueOnce({
          response: {
            totalPages: 2,
            voicesPage: [{ id: 'v1', name: 'Voice 1' }],
          },
          data: [{ id: 'v1', name: 'Voice 1' }],
        } as never)
        .mockResolvedValueOnce({
          response: {
            totalPages: 2,
            voicesPage: [{ id: 'v2', name: 'Voice 2' }],
          },
          data: [{ id: 'v2', name: 'Voice 2' }],
        } as never)
        .mockResolvedValueOnce({
          response: { totalPages: 1, voicesPage: [] },
          data: [],
        } as never);

      const speakers = await voice.getSpeakers();

      expect(speakers).toEqual(
        expect.arrayContaining([
          { voiceId: 'v1', name: 'Voice 1' },
          { voiceId: 'v2', name: 'Voice 2' },
        ]),
      );
      expect(speakers).toHaveLength(2);
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'HUME_AI', pageNumber: 0, pageSize: 100 }),
      );
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'HUME_AI', pageNumber: 1, pageSize: 100 }),
      );
    });

    it('should reject and propagate API errors', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      const apiError = new Error('Unauthorized');
      vi.spyOn(voice['client'].tts.voices, 'list').mockRejectedValue(apiError);

      await expect(voice.getSpeakers()).rejects.toThrow('Unauthorized');
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

  describe('realtime (EVI)', () => {
    let mockSocket: {
      on: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
      waitForOpen: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      sendAudioInput: ReturnType<typeof vi.fn>;
      sendAssistantInput: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockSocket = {
        on: vi.fn(),
        connect: vi.fn(),
        waitForOpen: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        sendAudioInput: vi.fn(),
        sendAssistantInput: vi.fn(),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('connect() should throw when configId is missing', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      await expect(voice.connect()).rejects.toThrow('configId');
    });

    it('connect() should throw when realtimeConfig has no configId', async () => {
      const voice = new HumeVoice({
        speechModel: { apiKey: 'test-key' },
        realtimeConfig: { configId: '' },
      });
      await expect(voice.connect()).rejects.toThrow('configId');
    });

    it('send() should throw when not connected', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      await expect(voice.send(new Int16Array(10))).rejects.toThrow('Not connected');
    });

    it('answer() should throw when not connected', async () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      await expect(voice.answer({ text: 'hi' })).rejects.toThrow('Not connected');
    });

    it('answer() with empty text should not throw when connected', async () => {
      const voice = new HumeVoice({
        speechModel: { apiKey: 'test-key' },
        realtimeConfig: { configId: 'cfg-123' },
      });
      const connectSpy = vi.spyOn(voice['client'].empathicVoice.chat, 'connect').mockReturnValue(mockSocket as never);
      await voice.connect();
      expect(connectSpy).toHaveBeenCalled();
      await voice.answer({ text: '' });
      expect(mockSocket.sendAssistantInput).not.toHaveBeenCalled();
      voice.close();
    });

    it('on/off should register and remove listeners', () => {
      const voice = new HumeVoice({ speechModel: { apiKey: 'test-key' } });
      const cb = vi.fn();
      voice.on('speaking', cb);
      voice.off('speaking', cb);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
