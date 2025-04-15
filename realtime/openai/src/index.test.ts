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
      realtime: {
        send: vi.fn(),
      },
      appendInputAudio: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
    })),
  };
});

describe('OpenAIRealtimeVoice', () => {
  let voice: OpenAIRealtimeVoice;
  let mockClient: any; // TODO: Replace with proper type once we have better type definitions

  beforeEach(() => {
    vi.clearAllMocks();
    voice = new OpenAIRealtimeVoice({
      chatModel: {
        apiKey: 'test-api-key',
      },
    });
    mockClient = (voice as any).client;
  });

  afterEach(() => {
    voice?.leave();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(voice).toBeInstanceOf(OpenAIRealtimeVoice);
      expect(mockClient).toBeDefined();
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

  describe('huddle and leave', () => {
    it('should connect and update state on huddle', async () => {
      await voice.huddle();
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.waitForSessionCreated).toHaveBeenCalled();
      expect((voice as any).state).toBe('huddle');
    });

    it('should disconnect and update state on leave', () => {
      voice.leave();
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect((voice as any).state).toBe('leave');
    });
  });

  describe('speak', () => {
    it('should handle string input', async () => {
      const testText = 'Hello, world!';
      await voice.speak(testText);
      expect(mockClient.realtime.send).toHaveBeenCalledWith('response.create', {
        response: {
          instructions: `Repeat the following text: ${testText}`,
          voice: undefined,
        },
      });
    });

    it('should throw error on empty input', async () => {
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
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
