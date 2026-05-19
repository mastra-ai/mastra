import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIRealtimeVoice } from './index';

// Mock RealtimeClient
vi.mock('openai-realtime-api', () => {
  return {
    RealtimeClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      waitForSessionCreated: vi.fn().mockResolvedValue(undefined),
      updateSession: vi.fn(),
      appendInputAudio: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
    })),
  };
});

vi.mock('ws', () => {
  return {
    WebSocket: vi.fn().mockImplementation(function () {
      return {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      };
    }),
  };
});

describe('OpenAIRealtimeVoice', () => {
  let voice: OpenAIRealtimeVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    voice = new OpenAIRealtimeVoice({
      apiKey: 'test-api-key',
    });
    voice.waitForOpen = () => Promise.resolve();
    voice.waitForSessionCreated = () => Promise.resolve();
  });

  afterEach(() => {
    voice?.disconnect();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(voice).toBeInstanceOf(OpenAIRealtimeVoice);
    });

    it('should initialize with custom speaker', () => {
      const customVoice = new OpenAIRealtimeVoice({
        speaker: 'shimmer',
      });
      expect(customVoice).toBeInstanceOf(OpenAIRealtimeVoice);
    });
  });

  describe('getSpeakers', () => {
    it('should return array of available voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
    });
  });

  describe('speak', () => {
    it('should handle string input', async () => {
      const testText = 'Hello, world!';
      await voice.speak(testText);
    });

    it('should throw error on empty input', async () => {
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });
  });

  describe('send', () => {
    it('should handle Int16Array input', async () => {
      const testArray = new Int16Array([1, 2, 3]);

      await voice.connect();
      voice.send(testArray);
    });
  });

  describe('event handling', () => {
    it('should register and trigger event listeners', () => {
      const mockCallback = vi.fn();
      voice.on('speak', mockCallback);

      // Simulate event emission
      (voice as any).emit('speak', 'test');

      expect(mockCallback).toHaveBeenCalledWith('test');
    });

    it('should remove event listeners', () => {
      const mockCallback = vi.fn();
      voice.on('speak', mockCallback);
      voice.off('speak', mockCallback);

      // Simulate event emission
      (voice as any).emit('speak', 'test');

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should forward OpenAI user transcription deltas using item_id as the response id', () => {
      let handleMessage: ((message: Buffer) => void) | undefined;
      (voice as any).ws = {
        on: vi.fn((event, callback) => {
          if (event === 'message') handleMessage = callback;
        }),
        close: vi.fn(),
      };

      const mockCallback = vi.fn();
      voice.on('writing', mockCallback);
      (voice as any).setupEventListeners();

      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'conversation.item.input_audio_transcription.delta',
            item_id: 'item_123',
            content_index: 0,
            delta: 'Hello',
          }),
        ),
      );

      expect(mockCallback).toHaveBeenCalledWith({ text: 'Hello', response_id: 'item_123', role: 'user' });
    });

    it('should forward and finalize completed-only OpenAI user transcriptions', () => {
      let handleMessage: ((message: Buffer) => void) | undefined;
      (voice as any).ws = {
        on: vi.fn((event, callback) => {
          if (event === 'message') handleMessage = callback;
        }),
        close: vi.fn(),
      };

      const mockCallback = vi.fn();
      voice.on('writing', mockCallback);
      (voice as any).setupEventListeners();

      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'conversation.item.input_audio_transcription.completed',
            item_id: 'item_123',
            content_index: 0,
            transcript: 'Hello',
          }),
        ),
      );

      expect(mockCallback).toHaveBeenCalledWith({ text: 'Hello', response_id: 'item_123', role: 'user' });
      expect(mockCallback).toHaveBeenCalledWith({ text: '\n', response_id: 'item_123', role: 'user' });
    });

    it('should not duplicate completed OpenAI user transcripts after deltas', () => {
      let handleMessage: ((message: Buffer) => void) | undefined;
      (voice as any).ws = {
        on: vi.fn((event, callback) => {
          if (event === 'message') handleMessage = callback;
        }),
        close: vi.fn(),
      };

      const mockCallback = vi.fn();
      voice.on('writing', mockCallback);
      (voice as any).setupEventListeners();

      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'conversation.item.input_audio_transcription.delta',
            item_id: 'item_123',
            content_index: 0,
            delta: 'Hel',
          }),
        ),
      );
      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'conversation.item.input_audio_transcription.delta',
            item_id: 'item_123',
            content_index: 0,
            delta: 'lo',
          }),
        ),
      );
      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'conversation.item.input_audio_transcription.completed',
            item_id: 'item_123',
            content_index: 0,
            transcript: 'Hello',
          }),
        ),
      );

      expect(mockCallback).toHaveBeenNthCalledWith(1, { text: 'Hel', response_id: 'item_123', role: 'user' });
      expect(mockCallback).toHaveBeenNthCalledWith(2, { text: 'lo', response_id: 'item_123', role: 'user' });
      expect(mockCallback).toHaveBeenNthCalledWith(3, { text: '\n', response_id: 'item_123', role: 'user' });
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });
  });
});
