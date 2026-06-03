import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
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

  describe('connect', () => {
    it('should not send the deprecated OpenAI-Beta header', async () => {
      await voice.connect();

      expect(WebSocket).toHaveBeenCalledTimes(1);
      const headers = (vi.mocked(WebSocket).mock.calls[0]![2] as { headers: Record<string, string> }).headers;
      expect(headers.Authorization).toBe('Bearer test-api-key');
      expect(headers).not.toHaveProperty('OpenAI-Beta');
    });
  });

  describe('send', () => {
    it('should handle Int16Array input', async () => {
      const testArray = new Int16Array([1, 2, 3]);

      await voice.connect();
      voice.send(testArray);
    });
  });

  describe('connect', () => {
    it('should send a GA-shaped session.update', async () => {
      await voice.connect();
      const ws = (voice as any).ws;
      const updates = (ws.send as ReturnType<typeof vi.fn>).mock.calls
        .map(([raw]: [string]) => JSON.parse(raw))
        .filter((ev: any) => ev.type === 'session.update');
      expect(updates).toHaveLength(1);
      const session = updates[0].session;
      expect(session.type).toBe('realtime');
      expect(session.audio?.input?.transcription?.model).toBeDefined();
      expect(session.audio?.output?.voice).toBeDefined();
      expect(session).not.toHaveProperty('voice');
      expect(session).not.toHaveProperty('input_audio_transcription');
    });
  });

  describe('function call dispatch', () => {
    it('should send exactly one response.create after multiple function_calls', async () => {
      (voice as any).ws = { on: vi.fn(), send: vi.fn(), close: vi.fn() };
      voice.addTools({
        tool_a: {
          description: 'A',
          inputSchema: undefined,
          execute: vi.fn().mockResolvedValue({ ok: 'a' }),
        },
        tool_b: {
          description: 'B',
          inputSchema: undefined,
          execute: vi.fn().mockResolvedValue({ ok: 'b' }),
        },
      } as any);

      await (voice as any).handleFunctionCalls({
        response: {
          output: [
            { type: 'function_call', name: 'tool_a', call_id: '1', arguments: '{}' },
            { type: 'function_call', name: 'tool_b', call_id: '2', arguments: '{}' },
          ],
        },
      });

      const sent = ((voice as any).ws.send as ReturnType<typeof vi.fn>).mock.calls.map(([raw]: [string]) =>
        JSON.parse(raw),
      );
      expect(sent.filter((ev: any) => ev.type === 'response.create')).toHaveLength(1);
    });

    it('should not send response.create when there are no function_call outputs', async () => {
      (voice as any).ws = { on: vi.fn(), send: vi.fn(), close: vi.fn() };

      await (voice as any).handleFunctionCalls({
        response: {
          output: [{ type: 'message', role: 'assistant', content: [] }],
        },
      });

      const sent = ((voice as any).ws.send as ReturnType<typeof vi.fn>).mock.calls.map(([raw]: [string]) =>
        JSON.parse(raw),
      );
      expect(sent.filter((ev: any) => ev.type === 'response.create')).toHaveLength(0);
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

    it('should handle GA OpenAI output text events', () => {
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
            type: 'response.output_text.delta',
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
            type: 'response.output_text.done',
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
