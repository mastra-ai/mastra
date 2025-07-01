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
    WebSocket: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    })),
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
  });
});
