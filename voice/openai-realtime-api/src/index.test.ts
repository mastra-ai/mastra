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

    it('should handle current OpenAI output audio events', async () => {
      let handleMessage: ((message: Buffer) => void) | undefined;
      (voice as any).ws = {
        on: vi.fn((event, callback) => {
          if (event === 'message') handleMessage = callback;
        }),
        close: vi.fn(),
      };

      const speakingCallback = vi.fn();
      const speakingDoneCallback = vi.fn();
      let speakerStream: NodeJS.ReadableStream | undefined;
      voice.on('speaking', speakingCallback);
      voice.on('speaking.done', speakingDoneCallback);
      voice.on('speaker', stream => {
        speakerStream = stream;
      });
      (voice as any).setupEventListeners();

      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'response.created',
            response: { id: 'response_123' },
          }),
        ),
      );

      const audio = Buffer.from('audio data');
      const streamChunks: Buffer[] = [];
      speakerStream?.on('data', chunk => {
        streamChunks.push(chunk);
      });
      const streamEnded = new Promise(resolve => {
        speakerStream?.on('end', resolve);
      });
      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'response.output_audio.delta',
            response_id: 'response_123',
            item_id: 'item_123',
            content_index: 0,
            output_index: 0,
            delta: audio.toString('base64'),
          }),
        ),
      );
      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'response.output_audio.done',
            response_id: 'response_123',
            item_id: 'item_123',
            content_index: 0,
            output_index: 0,
          }),
        ),
      );

      expect(speakingCallback).toHaveBeenCalledWith({ audio, response_id: 'response_123' });
      expect(speakingDoneCallback).toHaveBeenCalledWith({ response_id: 'response_123' });
      await streamEnded;
      expect(Buffer.concat(streamChunks)).toEqual(audio);
    });

    it('should handle current OpenAI output audio transcript events', () => {
      let handleMessage: ((message: Buffer) => void) | undefined;
      (voice as any).ws = {
        on: vi.fn((event, callback) => {
          if (event === 'message') handleMessage = callback;
        }),
        close: vi.fn(),
      };

      const writingCallback = vi.fn();
      voice.on('writing', writingCallback);
      (voice as any).setupEventListeners();

      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'response.output_audio_transcript.delta',
            response_id: 'response_123',
            item_id: 'item_123',
            content_index: 0,
            output_index: 0,
            delta: 'Hello',
          }),
        ),
      );
      handleMessage?.(
        Buffer.from(
          JSON.stringify({
            type: 'response.output_audio_transcript.done',
            response_id: 'response_123',
            item_id: 'item_123',
            content_index: 0,
            output_index: 0,
          }),
        ),
      );

      expect(writingCallback).toHaveBeenNthCalledWith(1, {
        text: 'Hello',
        response_id: 'response_123',
        role: 'assistant',
      });
      expect(writingCallback).toHaveBeenNthCalledWith(2, {
        text: '\n',
        response_id: 'response_123',
        role: 'assistant',
      });
    });
  });
});
