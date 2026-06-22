import { PassThrough } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { GeminiLiveVoice } from './index';

// Mock WebSocket
let mockWsInstance: any;
let currentWsUrl: string | undefined;

vi.mock('ws', () => {
  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    static CONNECTING = 0;
    static CLOSING = 2;

    send = vi.fn();
    close = vi.fn();
    on = vi.fn();
    once = vi.fn();
    emit = vi.fn();
    readyState = 1;

    constructor(url?: string) {
      currentWsUrl = url;
      mockWsInstance = this;
      return this;
    }
  }

  return { WebSocket: MockWebSocket };
});

// Mock GoogleAuth
vi.mock('google-auth-library', () => {
  class MockGoogleAuth {
    getAccessToken = vi.fn().mockResolvedValue('mock-access-token');
    getClient = vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-access-token' }),
    });

    constructor() {
      return this;
    }
  }

  return { GoogleAuth: MockGoogleAuth };
});

describe('GeminiLiveVoice', () => {
  let voice: GeminiLiveVoice;
  let mockWs: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWsInstance = null;
    currentWsUrl = undefined;

    // Create voice instance with test config
    voice = new GeminiLiveVoice({
      apiKey: 'test-api-key',
      model: 'gemini-2.0-flash-live-001',
      debug: false,
    });

    // mockWs will be set when connection is established
    mockWs = mockWsInstance;
  });

  afterEach(() => {
    voice?.disconnect();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with API key authentication', () => {
      const apiKeyVoice = new GeminiLiveVoice({
        apiKey: 'test-api-key',
      });
      expect(apiKeyVoice).toBeInstanceOf(GeminiLiveVoice);
    });

    it('should initialize with Vertex AI authentication', () => {
      const vertexVoice = new GeminiLiveVoice({
        vertexAI: true,
        project: 'test-project',
        location: 'us-central1',
      });
      expect(vertexVoice).toBeInstanceOf(GeminiLiveVoice);
    });

    it('should initialize with service account key file', () => {
      const serviceAccountVoice = new GeminiLiveVoice({
        vertexAI: true,
        project: 'test-project',
        serviceAccountKeyFile: '/path/to/key.json',
      });
      expect(serviceAccountVoice).toBeInstanceOf(GeminiLiveVoice);
    });

    it('should throw error when no API key for Gemini API', () => {
      // Clear environment variable for this test
      const originalApiKey = process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      try {
        expect(() => {
          new GeminiLiveVoice({});
        }).toThrow('Google API key is required');
      } finally {
        // Restore original environment variable
        if (originalApiKey) {
          process.env.GOOGLE_API_KEY = originalApiKey;
        }
      }
    });

    it('should throw error when no project for Vertex AI', () => {
      expect(() => {
        new GeminiLiveVoice({
          vertexAI: true,
        });
      }).toThrow('Google Cloud project ID is required');
    });
  });

  describe('Vertex AI configuration', () => {
    it('should build fully-qualified Vertex AI model path and default location for bare model names', async () => {
      const vertexVoice = new GeminiLiveVoice({
        vertexAI: true,
        project: 'test-project',
        model: 'gemini-2.0-flash-live-001',
      });

      vi.spyOn((vertexVoice as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (vertexVoice as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await vertexVoice.connect();

      expect(currentWsUrl).toContain('us-central1-aiplatform.googleapis.com');
      expect(currentWsUrl).toContain('LlmBidiService/BidiGenerateContent');

      const wsSent = ((vertexVoice as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.model).toBe(
        'projects/test-project/locations/us-central1/publishers/google/models/gemini-2.0-flash-live-001',
      );

      await vertexVoice.disconnect();
    });
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      // Mock connection open and session creation to prevent timeouts
      vi.spyOn((voice as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (voice as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      // Capture the connecting session event
      const connectingEvent = new Promise(resolve => voice.on('session', resolve));

      await voice.connect();

      // Verify we emitted a connecting event and transitioned to connected
      await expect(connectingEvent).resolves.toMatchObject({ state: 'connecting' });
      expect(voice.getConnectionState()).toBe('connected');
    });

    it('should handle connection errors', async () => {
      // Test that error events are properly handled
      const errorPromise = new Promise(resolve => {
        voice.on('error', resolve);
      });

      // Emit an error directly on the voice instance
      (voice as any).emit('error', { message: 'Connection failed', code: 'connection_error' });

      await expect(errorPromise).resolves.toBeDefined();
    });

    it('should disconnect properly', async () => {
      await voice.disconnect();
      expect(voice.getConnectionState()).toBe('disconnected');
    });

    it('should handle reconnection with session resumption', async () => {
      const sessionHandle = 'test-session-handle';
      const context = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      // Mock the connect method to avoid actual WebSocket connection
      const originalConnect = voice.connect.bind(voice);
      voice.connect = vi.fn().mockImplementation(async () => {
        // Set the state as if connected
        (voice as any).state = 'connected';
        (voice as any).ws = {
          send: vi.fn(),
          readyState: 1, // WebSocket.OPEN
          close: vi.fn(),
          once: vi.fn(),
        };
        (voice as any).connectionManager.setWebSocket((voice as any).ws);
        // Return immediately without actually connecting
        return Promise.resolve();
      });

      // Mock waitForSessionCreated to prevent timeout
      (voice as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      // Call resumeSession which internally calls connect
      await voice.resumeSession(sessionHandle, context);

      // Verify the session resumption state was set correctly
      expect((voice as any).sessionHandle).toBe(sessionHandle);
      expect((voice as any).isResuming).toBe(true);
      expect(voice.getContextHistory()).toEqual(
        context.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: expect.any(Number),
        })),
      );
      expect(voice.connect).toHaveBeenCalled();

      // Restore original connect method
      voice.connect = originalConnect;
    });
  });

  describe('Audio Streaming', () => {
    beforeEach(async () => {
      // Setup connected state and mock WebSocket
      (voice as any).state = 'connected';
      const mockSend = vi.fn();
      (voice as any).ws = {
        send: mockSend,
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);
      mockWs = (voice as any).ws;
    });

    it('should send audio buffer', async () => {
      const audioData = new Int16Array([1, 2, 3, 4, 5]);
      await voice.send(audioData);

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData).toHaveProperty('realtime_input');
      expect(sentData.realtime_input).toHaveProperty('audio');
    });

    it('should handle audio stream', async () => {
      const audioStream = new PassThrough();
      const sendPromise = voice.send(audioStream);

      // Write enough data to meet minimum chunk size (32 bytes = 16 samples)
      const audioData = new Int16Array(20); // 40 bytes
      for (let i = 0; i < 20; i++) {
        audioData[i] = i;
      }
      audioStream.write(Buffer.from(audioData.buffer));
      audioStream.end();

      await sendPromise;
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should throw error when not connected', async () => {
      (voice as any).state = 'disconnected';
      const audioData = new Int16Array([1, 2, 3]);

      await expect(voice.send(audioData)).rejects.toThrow('Not connected');
    });

    it('should handle stream errors', async () => {
      const audioStream = new PassThrough();
      const errorPromise = new Promise(resolve => {
        voice.on('error', resolve);
      });

      // Start sending but don't await to avoid unhandled rejection
      void voice.send(audioStream).catch(() => {
        // Expected to fail
      });

      // Give it a moment to set up listeners
      await new Promise(resolve => setTimeout(resolve, 10));

      audioStream.emit('error', new Error('Stream error'));

      await expect(errorPromise).resolves.toBeDefined();
    });
  });

  describe('Speech-to-Text (listen)', () => {
    beforeEach(async () => {
      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);
      mockWs = (voice as any).ws;
    });

    it('should transcribe audio stream', async () => {
      const audioStream = new PassThrough();
      // Resolve quickly without waiting for internal timeout
      vi.spyOn((voice as any).audioStreamManager, 'handleAudioTranscription').mockResolvedValue('');
      const listenPromise = voice.listen(audioStream);

      // Write audio data
      audioStream.write(Buffer.alloc(2000)); // Minimum size for transcription
      audioStream.end();

      // Simulate transcription response event
      setTimeout(() => {
        (voice as any).emit('writing', { text: 'Hello world', role: 'user' });
        (voice as any).emit('turnComplete', { timestamp: Date.now() });
      }, 10);

      const result = await listenPromise;
      expect(result).toBe('');
    });

    it('should handle timeout', async () => {
      const audioStream = new PassThrough();
      vi.spyOn((voice as any).audioStreamManager, 'handleAudioTranscription').mockRejectedValue(new Error('timeout'));
      const listenPromise = voice.listen(audioStream);

      audioStream.write(Buffer.alloc(2000));
      audioStream.end();

      // No response; promise should reject via mocked timeout
      await expect(listenPromise).rejects.toThrow('timeout');
    });

    it('should return empty string for short audio', async () => {
      const audioStream = new PassThrough();
      vi.spyOn((voice as any).audioStreamManager, 'handleAudioTranscription').mockResolvedValue('');
      const listenPromise = voice.listen(audioStream);

      // Write very short audio (< 1000 bytes)
      audioStream.write(Buffer.alloc(500));
      audioStream.end();

      const result = await listenPromise;
      expect(result).toBe('');
    });
  });

  describe('Text-to-Speech (speak)', () => {
    beforeEach(async () => {
      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);
      mockWs = (voice as any).ws;
    });

    it('should send text for speech synthesis', async () => {
      await voice.speak('Hello, world!');

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData).toHaveProperty('client_content');
    });

    it('should handle stream input', async () => {
      const textStream = new PassThrough();
      textStream.end('Hello from stream');

      await voice.speak(textStream);

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData).toHaveProperty('client_content');
      expect(sentData.client_content.turns[0].parts[0].text).toBe('Hello from stream');
    });

    it('should throw error on empty text', async () => {
      await expect(voice.speak('')).rejects.toThrow('empty');
    });

    it('should use custom voice when specified', async () => {
      await voice.speak('Test', { speaker: 'Puck' });

      expect(mockWs.send).toHaveBeenCalled();

      const sentPayloads = mockWs.send.mock.calls.map((call: any[]) => JSON.parse(call[0]));

      // Verify a session.update was sent with the requested voice
      const updateMsg = sentPayloads.find((p: any) => p.session && p.session.generation_config);
      expect(updateMsg).toBeDefined();
      expect(updateMsg.session.generation_config.speech_config.voice_config.prebuilt_voice_config.voice_name).toBe(
        'Puck',
      );

      // Verify the client_content was sent with the text
      const clientContent = sentPayloads.find((p: any) => p.client_content);
      expect(clientContent).toBeDefined();
      expect(clientContent.client_content.turns[0].parts[0].text).toBe('Test');
    });
  });

  describe('Tool Calling', () => {
    it('should add tools', () => {
      const tools = {
        search: {
          id: 'search',
          description: 'Search the web',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
          execute: async ({}: { context: any }) => ({ results: [] }),
        },
      };

      voice.addTools(tools);
      const configuredTools = voice.listTools();
      expect(configuredTools).toBeDefined();
      expect(Object.keys(configuredTools || {}).length).toBe(1);
    });

    it('should handle tool calls', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ result: 'success' });
      const tools = {
        testTool: {
          id: 'testTool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {} },
          execute: mockExecute,
        },
      };

      voice.addTools(tools);

      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);
      mockWs = (voice as any).ws;

      // Simulate tool call from Gemini (provider message format)
      const toolCallData = {
        toolCall: {
          name: 'testTool',
          args: { test: 'value' },
          id: 'test-id',
        },
      };

      await (voice as any).handleToolCall(toolCallData);

      // Tools receive args directly as first param, and execution context as second
      expect(mockExecute).toHaveBeenCalledWith(
        { test: 'value' },
        expect.objectContaining({ requestContext: undefined }),
      );
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should emit tool call events', async () => {
      const tools = {
        testTool: {
          id: 'testTool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {} },
          execute: async ({}: { context: any }) => ({ result: 'success' }),
        },
      };

      voice.addTools(tools);

      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);

      const toolCallPromise = new Promise(resolve => voice.on('toolCall', resolve));

      const toolCallData = {
        toolCall: {
          name: 'testTool',
          args: {},
          id: 'test-id',
        },
      };

      await (voice as any).handleToolCall(toolCallData);

      await expect(toolCallPromise).resolves.toMatchObject({ name: 'testTool' });
      // Capture current ws used and assert send was invoked
      mockWs = (voice as any).ws;
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should handle tool execution errors', async () => {
      const tools = {
        errorTool: {
          id: 'errorTool',
          description: 'Error tool',
          inputSchema: { type: 'object', properties: {} },
          execute: async ({}: { context: any }) => {
            throw new Error('Tool failed');
          },
        },
      };

      voice.addTools(tools);

      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);

      const errorPromise = new Promise(resolve => voice.on('error', resolve));

      await (voice as any).handleToolCall({
        toolCall: {
          name: 'errorTool',
          args: {},
          id: 'test-id',
        },
      });

      await expect(errorPromise).resolves.toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should get session info', () => {
      const info = voice.getSessionInfo();
      expect(info).toHaveProperty('state');
      expect(info).toHaveProperty('contextSize');
    });

    it('should manage context history', () => {
      voice.addToContext('user', 'Hello');
      voice.addToContext('assistant', 'Hi there!');

      const history = voice.getContextHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should clear context', () => {
      voice.addToContext('user', 'Test');
      voice.clearContext();

      const history = voice.getContextHistory();
      expect(history).toHaveLength(0);
    });

    it('should update session configuration', async () => {
      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);
      mockWs = (voice as any).ws;

      // Simulate server acknowledgement to resolve update promise
      setTimeout(() => {
        (voice as any).eventManager.getEventEmitter().emit('session.updated', { ok: true } as any);
      }, 10);

      await voice.updateSessionConfig({
        sessionConfig: { vad: { enabled: true, sensitivity: 0.5 } },
      });

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData).toHaveProperty('type', 'session.update');
      expect(sentData).toHaveProperty('session');
    });

    it('should set auto-reconnect', () => {
      voice.setAutoReconnect(true);
      const info = voice.getSessionInfo();
      expect(info.config?.enableResumption).toBe(true);
    });

    describe('sendContext', () => {
      beforeEach(() => {
        (voice as any).state = 'connected';
        (voice as any).ws = {
          send: vi.fn(),
          readyState: 1,
          close: vi.fn(),
          once: vi.fn(),
        };
        (voice as any).connectionManager.setWebSocket((voice as any).ws);
        mockWs = (voice as any).ws;
      });

      it('should send client_content with turnComplete: false by default', async () => {
        await voice.sendContext([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ]);

        expect(mockWs.send).toHaveBeenCalledTimes(1);
        const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(sentData).toHaveProperty('client_content');
        expect(sentData.client_content.turnComplete).toBe(false);
        expect(sentData.client_content.turns).toHaveLength(2);
        expect(sentData.client_content.turns[0]).toEqual({ role: 'user', parts: [{ text: 'Hello' }] });
        expect(sentData.client_content.turns[1]).toEqual({ role: 'model', parts: [{ text: 'Hi there!' }] });
      });

      it('should allow turnComplete: true override', async () => {
        await voice.sendContext([{ role: 'user', content: 'Final message' }], { turnComplete: true });

        const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(sentData.client_content.turnComplete).toBe(true);
      });

      it('should update local context history', async () => {
        voice.clearContext();
        await voice.sendContext([
          { role: 'user', content: 'Question' },
          { role: 'assistant', content: 'Answer' },
        ]);

        const history = voice.getContextHistory();
        expect(history).toHaveLength(2);
        expect(history[0].role).toBe('user');
        expect(history[0].content).toBe('Question');
        expect(history[1].role).toBe('assistant');
        expect(history[1].content).toBe('Answer');
      });

      it('should skip sending when turns array is empty', async () => {
        await voice.sendContext([]);
        expect(mockWs.send).not.toHaveBeenCalled();
      });

      it('should throw when not connected', async () => {
        (voice as any).state = 'disconnected';
        await expect(voice.sendContext([{ role: 'user', content: 'Hello' }])).rejects.toThrow('Not connected');
      });
    });
  });

  describe('Event System', () => {
    it('should emit and listen to events', () => {
      const callback = vi.fn();
      voice.on('speaking', callback);

      (voice as any).emit('speaking', { audio: 'base64data' });

      expect(callback).toHaveBeenCalledWith({ audio: 'base64data' });
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();
      voice.on('writing', callback);
      voice.off('writing', callback);

      (voice as any).emit('writing', { text: 'test', role: 'user' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      voice.on('error', callback1);
      voice.on('error', callback2);

      (voice as any).emit('error', { message: 'test error' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Speaker Management', () => {
    it('should return available speakers', async () => {
      const speakers = await voice.getSpeakers();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
      expect(speakers[0]).toHaveProperty('description');
    });

    it('should include all Gemini voices', async () => {
      const speakers = await voice.getSpeakers();
      const voiceIds = speakers.map(s => s.voiceId);

      expect(voiceIds).toContain('Puck');
      expect(voiceIds).toContain('Charon');
      expect(voiceIds).toContain('Kore');
      expect(voiceIds).toContain('Fenrir');
    });
  });

  describe('Authentication', () => {
    it('should be configured for Gemini API when apiKey provided', () => {
      const apiVoice = new GeminiLiveVoice({ apiKey: 'test-key' });
      expect((apiVoice as any).authManager.isConfigured()).toBe(true);
      expect((apiVoice as any).authManager.isUsingVertexAI()).toBe(false);
    });

    it('should configure Vertex AI auth with project', () => {
      const vertexVoice = new GeminiLiveVoice({
        vertexAI: true,
        project: 'test-project',
      });
      expect((vertexVoice as any).authManager.isUsingVertexAI()).toBe(true);
      expect((vertexVoice as any).authManager.getConfig().project).toBe('test-project');
    });

    it('should obtain access token via AuthManager', async () => {
      const vertexVoice = new GeminiLiveVoice({
        vertexAI: true,
        project: 'test-project',
      });

      await (vertexVoice as any).authManager.initialize();
      await expect((vertexVoice as any).authManager.getAccessToken()).resolves.toBe('mock-access-token');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors gracefully', async () => {
      const errorPromise = new Promise(resolve => voice.on('error', resolve));

      // Directly emit error on voice instance since our mock doesn't extend EventEmitter
      (voice as any).emit('error', { message: 'WebSocket error', code: 'ws_error' });

      await expect(errorPromise).resolves.toBeDefined();
    });

    it('should handle malformed messages', () => {
      // Test that malformed messages don't crash the system
      // Since handleGeminiMessage is private, we'll test indirectly
      expect(() => {
        // This would normally be called internally when a message is received
        // For now, we just verify the error handling setup
        (voice as any).connectionState = 'connected';
      }).not.toThrow();
    });

    it('should handle session end gracefully', async () => {
      const sessionPromise = new Promise(resolve => voice.on('session', resolve));

      // Emit session event directly
      (voice as any).emit('session', { state: 'disconnected' });

      await expect(sessionPromise).resolves.toMatchObject({
        state: 'disconnected',
      });
    });
  });

  describe('Integration - Realistic flows', () => {
    beforeEach(() => {
      (voice as any).state = 'connected';
      (voice as any).ws = {
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
        close: vi.fn(),
        once: vi.fn(),
      };
      (voice as any).connectionManager.setWebSocket((voice as any).ws);
      mockWs = (voice as any).ws;
    });

    it('should resolve listen() with aggregated user transcript on turnComplete', async () => {
      const audioStream = new PassThrough();
      const listenPromise = voice.listen(audioStream);

      // Provide audio bytes and end stream
      audioStream.write(Buffer.alloc(2000));
      audioStream.end();

      // Simulate transcript chunks; ensure turnComplete is emitted after writing handlers run
      setTimeout(() => {
        (voice as any).emit('writing', { text: 'Hello ', role: 'user' });
        (voice as any).emit('writing', { text: 'world', role: 'user' });
        setTimeout(() => {
          (voice as any).emit('turnComplete', { timestamp: Date.now() });
        }, 0);
      }, 5);

      await expect(listenPromise).resolves.toBe('Hello world');
    });

    it('should emit speaking and speaker stream for inbound audio and cleanup on turnComplete', async () => {
      const speakingEvent = new Promise<any>(resolve => voice.on('speaking', resolve));
      const speakerEvent = new Promise<NodeJS.ReadableStream>(resolve => voice.on('speaker', resolve));

      // Create a small PCM16 audio base64 payload
      const samples = new Int16Array([1, -2, 3, -4]);
      const base64Audio = Buffer.from(samples.buffer).toString('base64');

      // Deliver server content with audio
      await (voice as any).handleGeminiMessage({
        responseId: 'resp-1',
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: { mimeType: 'audio/pcm', data: base64Audio },
              },
            ],
          },
        },
      });

      const speakingPayload = await speakingEvent;
      const speakerStream = await speakerEvent;

      expect(speakingPayload).toHaveProperty('audio');
      expect(speakingPayload).toHaveProperty('audioData');
      expect(speakingPayload).toHaveProperty('sampleRate');
      expect(typeof (speakerStream as any).write).toBe('function');

      // Complete turn and ensure streams are cleaned up
      await (voice as any).handleGeminiMessage({ serverContent: { turnComplete: true } });
      expect((voice as any).audioStreamManager.getActiveStreamCount()).toBe(0);
    });

    it('connect() should send setup message with model and instructions', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k', model: 'gemini-2.0-flash-exp', instructions: 'You are test' });

      // Mock connection open and session ready
      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      // Extract sent messages
      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      expect(wsSent).toHaveBeenCalled();
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg).toBeDefined();
      expect(setupMsg.setup.model).toBe('models/gemini-2.0-flash-exp');
      expect(setupMsg.setup.system_instruction.parts[0].text).toBe('You are test');
    });

    it('connect() should default model to gemini-3.1-flash-live-preview when none is supplied', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k' });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.model).toBe('models/gemini-3.1-flash-live-preview');
    });

    it('connect() should always emit generation_config.response_modalities: ["AUDIO"]', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k' });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.generation_config).toBeDefined();
      expect(setupMsg.setup.generation_config.response_modalities).toEqual(['AUDIO']);
    });

    it('connect() should include speech_config.voice_config.prebuilt_voice_config.voice_name when speaker is set', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k', speaker: 'Puck' });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.generation_config.speech_config.voice_config.prebuilt_voice_config.voice_name).toBe('Puck');
    });

    it('connect() should pick up apiKey and model placed on realtimeConfig root (not inside options)', async () => {
      const v = new GeminiLiveVoice({
        realtimeConfig: {
          model: 'gemini-3.1-flash-live-preview',
          apiKey: 'root-key',
          // intentionally no `options.apiKey` — caller relies on the root field
        },
      });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.model).toBe('models/gemini-3.1-flash-live-preview');
      expect((v as any).options.apiKey).toBe('root-key');
    });

    it('connect() should honor a VoiceConfig-root speaker passed alongside realtimeConfig', async () => {
      const v = new GeminiLiveVoice({
        speaker: 'Charon',
        realtimeConfig: {
          model: 'gemini-3.1-flash-live-preview',
          apiKey: 'k',
          options: { apiKey: 'k' },
        },
      });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.generation_config.speech_config.voice_config.prebuilt_voice_config.voice_name).toBe(
        'Charon',
      );
    });

    it('connect() should emit tools as a single function_declarations container holding every tool', async () => {
      const v = new GeminiLiveVoice({
        apiKey: 'k',
        tools: [
          { name: 'first', description: 'a', parameters: { type: 'object', properties: {} } },
          { name: 'second', description: 'b', parameters: { type: 'object', properties: {} } },
        ],
      });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      expect(setupMsg.setup.tools).toHaveLength(1);
      expect(setupMsg.setup.tools[0].function_declarations).toHaveLength(2);
      expect(setupMsg.setup.tools[0].function_declarations.map((d: any) => d.name)).toEqual(['first', 'second']);
    });

    it('updateSessionConfig({ tools }) should merge config.tools with addTools() registrations into one container', async () => {
      // Mirror sendInitialConfig: both tool sources contribute. Previously updateSessionConfig
      // dropped config.tools entirely whenever any `addTools()` registrations existed.
      voice.addTools({
        registered: {
          id: 'registered',
          description: 'r',
          parameters: { type: 'object', properties: {} },
          execute: vi.fn() as any,
        },
      });

      setTimeout(() => {
        (voice as any).eventManager.getEventEmitter().emit('session.updated', { ok: true } as any);
      }, 10);

      await voice.updateSessionConfig({
        tools: [{ name: 'fromConfig', description: 'c', parameters: { type: 'object', properties: {} } }],
      });

      const calls = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const updateMsg = calls.find((p: any) => p.session?.tools !== undefined);
      expect(updateMsg.session.tools).toHaveLength(1);
      const names = updateMsg.session.tools[0].function_declarations.map((d: any) => d.name);
      expect(names).toContain('fromConfig');
      expect(names).toContain('registered');
    });

    it('updateSessionConfig({ tools }) should emit the same single-container function_declarations shape as setup', async () => {
      // Mid-session updateSessionConfig must not regress to the one-container-per-tool shape; Gemini
      // accepts that shape at the wire but suppresses tool_call frames, silently breaking tool routing.
      setTimeout(() => {
        (voice as any).eventManager.getEventEmitter().emit('session.updated', { ok: true } as any);
      }, 10);

      await voice.updateSessionConfig({
        tools: [
          { name: 'alpha', description: 'a', parameters: { type: 'object', properties: {} } },
          { name: 'beta', description: 'b', parameters: { type: 'object', properties: {} } },
        ],
      });

      const calls = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const updateMsg = calls.find((p: any) => p.session?.tools !== undefined);
      expect(updateMsg).toBeDefined();
      expect(updateMsg.session.tools).toHaveLength(1);
      expect(updateMsg.session.tools[0].function_declarations).toHaveLength(2);
      expect(updateMsg.session.tools[0].function_declarations.map((d: any) => d.name)).toEqual(['alpha', 'beta']);
    });

    it('should wrap array tool results in { result } so the Gemini Live `response` proto field stays a struct', async () => {
      const mockExecute = vi.fn().mockResolvedValue(['hit-1', 'hit-2']);
      voice.addTools({
        searchTool: { id: 'searchTool', description: 'd', inputSchema: {}, execute: mockExecute as any },
      });

      await (voice as any).handleGeminiMessage({
        toolCall: { name: 'searchTool', args: {}, id: 'id-array' },
      });

      const payloads = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const toolResult = payloads.find((p: any) => p.toolResponse);
      expect(toolResult.toolResponse.functionResponses[0].name).toBe('searchTool');
      expect(toolResult.toolResponse.functionResponses[0].response).toEqual({ result: ['hit-1', 'hit-2'] });
    });

    it('should wrap non-plain-object tool results (Date, Map, Set, Error, class instances) in { result }', async () => {
      // Bare Map/Set/Date/Error/class instances JSON.stringify to `{}` or non-struct shapes; the
      // proto `response` field is a struct, so we must wrap to keep tool data on the wire.
      class Custom {
        constructor(public value: number) {}
      }
      const cases: Array<{ id: string; toolName: string; result: unknown }> = [
        { id: 'id-map', toolName: 'mapTool', result: new Map([['k', 'v']]) },
        { id: 'id-set', toolName: 'setTool', result: new Set([1, 2]) },
        { id: 'id-date', toolName: 'dateTool', result: new Date('2026-01-01T00:00:00Z') },
        { id: 'id-class', toolName: 'classTool', result: new Custom(42) },
      ];

      for (const c of cases) {
        voice.addTools({
          [c.toolName]: {
            id: c.toolName,
            description: 'd',
            inputSchema: {},
            execute: vi.fn().mockResolvedValue(c.result) as any,
          },
        });
        await (voice as any).handleGeminiMessage({ toolCall: { name: c.toolName, args: {}, id: c.id } });
      }

      const payloads = mockWs.send.mock.calls.map((call: any[]) => JSON.parse(call[0]));
      for (const c of cases) {
        const toolResult = payloads.find((p: any) => p.toolResponse?.functionResponses?.[0]?.id === c.id);
        expect(toolResult, `payload for ${c.toolName}`).toBeDefined();
        const response = toolResult.toolResponse.functionResponses[0].response;
        // Every non-plain-object result must be wrapped — the wire field is always an object with `result` key.
        expect(response).toHaveProperty('result');
      }
    });

    it('should pass plain-object tool results through unwrapped', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ temperature: 72, conditions: 'sunny' });
      voice.addTools({
        weatherTool: { id: 'weatherTool', description: 'd', inputSchema: {}, execute: mockExecute as any },
      });

      await (voice as any).handleGeminiMessage({
        toolCall: { name: 'weatherTool', args: {}, id: 'id-plain' },
      });

      const payloads = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const toolResult = payloads.find((p: any) => p.toolResponse);
      expect(toolResult.toolResponse.functionResponses[0].response).toEqual({ temperature: 72, conditions: 'sunny' });
    });

    it('updateSessionConfig({ tools: [] }) should clear tools even when addTools() registry is non-empty', async () => {
      // Explicit-clear intent: caller passes an empty `config.tools` array to remove all tools
      // mid-session. Without this honor, addTools() registrations would silently survive.
      voice.addTools({
        sticky: { id: 'sticky', description: 'd', inputSchema: {}, execute: vi.fn() as any },
      });

      setTimeout(() => {
        (voice as any).eventManager.getEventEmitter().emit('session.updated', { ok: true } as any);
      }, 10);

      await voice.updateSessionConfig({ tools: [] });

      const calls = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const updateMsg = calls.find((p: any) => p.session?.tools !== undefined);
      expect(updateMsg).toBeDefined();
      expect(updateMsg.session.tools).toEqual([]);
    });

    it('speak() should send per-turn session.update before content (language, modalities, voice)', async () => {
      await voice.speak('Hello', { languageCode: 'en-US', responseModalities: ['AUDIO'] as any, speaker: 'Puck' });

      const calls = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const updateIdx = calls.findIndex((p: any) => p.type === 'session.update' || p.session);
      const contentIdx = calls.findIndex((p: any) => p.client_content);

      expect(updateIdx).toBeGreaterThanOrEqual(0);
      expect(contentIdx).toBeGreaterThan(updateIdx);

      const updateMsg = calls[updateIdx];
      expect(updateMsg.session.generation_config.response_modalities).toContain('AUDIO');
      expect(updateMsg.session.generation_config.speech_config.language_code).toBe('en-US');
      expect(updateMsg.session.generation_config.speech_config.voice_config.prebuilt_voice_config.voice_name).toBe(
        'Puck',
      );

      const contentMsg = calls[contentIdx];
      expect(contentMsg.client_content.turns[0].parts[0].text).toBe('Hello');
    });

    it('should process toolCall via inbound message and send tool_result', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ result: 'ok' });
      voice.addTools({ testTool: { id: 'testTool', description: 'd', inputSchema: {}, execute: mockExecute as any } });

      await (voice as any).handleGeminiMessage({
        toolCall: { name: 'testTool', args: { q: 1 }, id: 'id-1' },
      });

      expect(mockExecute).toHaveBeenCalled();
      expect(mockWs.send).toHaveBeenCalled();
      const payloads = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const toolResult = payloads.find((p: any) => p.toolResponse);
      expect(toolResult).toBeDefined();
      expect(toolResult.toolResponse.functionResponses).toBeDefined();
      expect(toolResult.toolResponse.functionResponses[0].id).toBe('id-1');
      expect(toolResult.toolResponse.functionResponses[0].name).toBe('testTool');
      expect(toolResult.toolResponse.functionResponses[0].response).toEqual({ result: 'ok' });
    });

    /**
     * Gemini Live's `parameters` field is OpenAPI 3.0 Schema Object, not JSON Schema 2020-12.
     * Several JSON Schema constructs are rejected by the Gemini Live wire validator with
     * `1007 Unknown name "..."`. See https://github.com/mastra-ai/mastra/issues/17020.
     *
     * The sanitizeToolParameters method currently strips `$schema` and `additionalProperties`,
     * but the following constructs still pass through unsanitized and are rejected by Gemini:
     *   - `oneOf` (discriminated unions) — should be rewritten to `anyOf`
     *   - `const` (literals) — should be rewritten to `enum: [value]`
     *   - `type: ['T', 'null']` or `type: 'null'` (nullable) — should be rewritten
     */

    it('should rewrite oneOf to anyOf in tool parameter schemas for Gemini Live OpenAPI 3.0 compat', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k' });

      v.addTools({
        notify: {
          id: 'notify',
          description: 'Send a notification',
          inputSchema: z.object({
            channel: z.discriminatedUnion('type', [
              z.object({ type: z.literal('email'), address: z.string() }),
              z.object({ type: z.literal('sms'), phone: z.string() }),
            ]),
          }),
          execute: vi.fn() as any,
        },
      });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      const params = setupMsg.setup.tools[0].function_declarations[0].parameters;

      // Gemini Live rejects `oneOf` — discriminated unions must use `anyOf`
      const json = JSON.stringify(params);
      expect(json).not.toContain('"oneOf"');
      expect(json).toContain('"anyOf"');
    });

    it('should rewrite const to enum in tool parameter schemas for Gemini Live OpenAPI 3.0 compat', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k' });

      v.addTools({
        setStatus: {
          id: 'setStatus',
          description: 'Set status',
          inputSchema: z.object({
            status: z.literal('active'),
          }),
          execute: vi.fn() as any,
        },
      });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      const params = setupMsg.setup.tools[0].function_declarations[0].parameters;

      // Gemini Live rejects `const` — literals must use `enum: [value]`
      const json = JSON.stringify(params);
      expect(json).not.toContain('"const"');
      expect(params.properties.status.enum).toEqual(['active']);
    });

    it('should rewrite nullable type arrays for Gemini Live OpenAPI 3.0 compat', async () => {
      const v = new GeminiLiveVoice({ apiKey: 'k' });

      v.addTools({
        update: {
          id: 'update',
          description: 'Update a record',
          inputSchema: z.object({
            name: z.string().nullable(),
          }),
          execute: vi.fn() as any,
        },
      });

      vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
      (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

      await v.connect();

      const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
      const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const setupMsg = payloads.find((p: any) => p.setup);
      const params = setupMsg.setup.tools[0].function_declarations[0].parameters;

      // Gemini Live rejects `type: 'null'` and `type: ['string', 'null']`.
      // Nullable fields should be rewritten to the base type (e.g. `type: 'string'`)
      // with optional `nullable: true` (OpenAPI 3.0 convention).
      const json = JSON.stringify(params);
      expect(json).not.toContain('"null"');

      // The name property should have a concrete type, not an anyOf with null,
      // and nullability should be expressed via OpenAPI 3.0's `nullable: true`.
      const nameProp = params.properties.name;
      expect(nameProp.type).toBe('string');
      expect(nameProp.nullable).toBe(true);
      expect(nameProp.anyOf).toBeUndefined();
    });

    it('should emit usage event from usageMetadata', async () => {
      const usagePromise = new Promise<any>(resolve => voice.on('usage', resolve));

      await (voice as any).handleGeminiMessage({
        usageMetadata: { promptTokenCount: 1, responseTokenCount: 2, totalTokenCount: 3 },
      });

      const usage = await usagePromise;
      expect(usage.inputTokens).toBe(1);
      expect(usage.outputTokens).toBe(2);
      expect(usage.totalTokens).toBe(3);
      expect(['audio', 'text', 'video']).toContain(usage.modality);
    });
  });

  describe('Native-audio behavioral signals (#17021)', () => {
    describe('Setup payload', () => {
      // Setup-level flags are required by the Gemini Live wire protocol: the server only emits
      // transcription frames when `input_audio_transcription` / `output_audio_transcription` are
      // present, and only emits `serverContent.interrupted = true` when `realtime_input_config`
      // declares `activity_handling: 'START_OF_ACTIVITY_INTERRUPTS'`. These tests pin the wire
      // shape so we cannot regress these flags without breaking the build.
      it('enables input/output transcription unconditionally in the setup payload', async () => {
        const v = new GeminiLiveVoice({ apiKey: 'k', model: 'gemini-2.5-flash-native-audio-preview-12-2025' });
        vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
        (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

        await v.connect();

        const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
        const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
        const setupMsg = payloads.find((p: any) => p.setup);
        expect(setupMsg.setup.input_audio_transcription).toEqual({});
        expect(setupMsg.setup.output_audio_transcription).toEqual({});
      });

      it('enables activity-based interrupts in the setup payload', async () => {
        const v = new GeminiLiveVoice({ apiKey: 'k' });
        vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
        (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

        await v.connect();

        const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
        const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
        const setupMsg = payloads.find((p: any) => p.setup);
        expect(setupMsg.setup.realtime_input_config).toEqual({
          activity_handling: 'START_OF_ACTIVITY_INTERRUPTS',
        });
      });

      it('uses snake_case keys for all native-audio setup fields', async () => {
        // Native-audio models reject camelCase setup keys at the wire level (1007 close code).
        // Guard explicitly against accidental drift back to camelCase.
        const v = new GeminiLiveVoice({ apiKey: 'k' });
        vi.spyOn((v as any).connectionManager, 'waitForOpen').mockResolvedValue(undefined as any);
        (v as any).waitForSessionCreated = vi.fn().mockResolvedValue(undefined);

        await v.connect();

        const wsSent = ((v as any).connectionManager.getWebSocket() as any).send as any;
        const payloads = wsSent.mock.calls.map((c: any[]) => JSON.parse(c[0]));
        const setupMsg = payloads.find((p: any) => p.setup);
        const json = JSON.stringify(setupMsg.setup);
        expect(json).not.toContain('inputAudioTranscription');
        expect(json).not.toContain('outputAudioTranscription');
        expect(json).not.toContain('realtimeInputConfig');
        expect(json).not.toContain('activityHandling');
      });
    });

    describe('Transcription routing', () => {
      it('emits writing { role: "user" } for inputTranscription frames', async () => {
        const writingPromise = new Promise<any>(resolve => voice.on('writing', resolve));

        await (voice as any).handleGeminiMessage({
          serverContent: {
            inputTranscription: { text: "What's the weather?" },
          },
        });

        const ev = await writingPromise;
        expect(ev).toEqual({ text: "What's the weather?", role: 'user' });
      });

      it('emits writing { role: "assistant" } for outputTranscription frames', async () => {
        const writingPromise = new Promise<any>(resolve => voice.on('writing', resolve));

        await (voice as any).handleGeminiMessage({
          serverContent: {
            outputTranscription: { text: "It's sunny today." },
          },
        });

        const ev = await writingPromise;
        expect(ev).toEqual({ text: "It's sunny today.", role: 'assistant' });
      });
    });

    describe('Interrupt routing', () => {
      it('emits interrupt event when serverContent.interrupted is true', async () => {
        const interruptPromise = new Promise<any>(resolve => voice.on('interrupt', resolve));
        const before = Date.now();

        await (voice as any).handleGeminiMessage({
          serverContent: { interrupted: true },
        });

        const ev = await interruptPromise;
        expect(ev.type).toBe('user');
        expect(ev.timestamp).toBeGreaterThanOrEqual(before);
      });

      it('does not emit interrupt when serverContent.interrupted is absent', async () => {
        const onInterrupt = vi.fn();
        voice.on('interrupt', onInterrupt);

        await (voice as any).handleGeminiMessage({
          serverContent: {
            modelTurn: { parts: [{ text: 'hello' }] },
          },
        });

        expect(onInterrupt).not.toHaveBeenCalled();
      });
    });

    describe('Thinking vs. writing routing for modelTurn.parts.text', () => {
      it('routes modelTurn.parts.text to writing on non-native-audio models', async () => {
        const v = new GeminiLiveVoice({
          apiKey: 'k',
          model: 'gemini-3.1-flash-live-preview', // half-cascade, not native-audio
        });
        const onWriting = vi.fn();
        const onThinking = vi.fn();
        v.on('writing', onWriting);
        v.on('thinking', onThinking);

        await (v as any).handleGeminiMessage({
          serverContent: {
            modelTurn: { parts: [{ text: 'spoken response' }] },
          },
        });

        expect(onWriting).toHaveBeenCalledWith({ text: 'spoken response', role: 'assistant' });
        expect(onThinking).not.toHaveBeenCalled();

        v.disconnect();
      });

      it('routes modelTurn.parts.text to thinking on native-audio models', async () => {
        const v = new GeminiLiveVoice({
          apiKey: 'k',
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        });
        const onWriting = vi.fn();
        const onThinking = vi.fn();
        v.on('writing', onWriting);
        v.on('thinking', onThinking);

        await (v as any).handleGeminiMessage({
          serverContent: {
            modelTurn: { parts: [{ text: 'internal reasoning' }] },
          },
        });

        expect(onThinking).toHaveBeenCalledWith({ text: 'internal reasoning' });
        // Critically: `writing` must NOT fire for reasoning text on native-audio. If it did, the
        // consumer would render reasoning as the assistant's spoken response.
        expect(onWriting).not.toHaveBeenCalled();

        v.disconnect();
      });

      it('on native-audio, spoken response comes through outputTranscription as writing { role: "assistant" }', async () => {
        // End-to-end shape test: a single native-audio turn produces (a) `thinking` from
        // modelTurn.parts.text and (b) `writing { role: "assistant" }` from outputTranscription.
        // These channels must remain distinct.
        const v = new GeminiLiveVoice({
          apiKey: 'k',
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        });
        const writings: any[] = [];
        const thinkings: any[] = [];
        v.on('writing', e => writings.push(e));
        v.on('thinking', e => thinkings.push(e));

        await (v as any).handleGeminiMessage({
          serverContent: {
            modelTurn: { parts: [{ text: 'Let me check the forecast...' }] },
            outputTranscription: { text: "It's sunny." },
          },
        });

        expect(thinkings).toEqual([{ text: 'Let me check the forecast...' }]);
        expect(writings).toEqual([{ text: "It's sunny.", role: 'assistant' }]);

        v.disconnect();
      });
    });

    describe('Per-turn aggregation of assistant context', () => {
      it('aggregates assistant text across frames and commits to context once per turn', async () => {
        // Live API streams assistant text across many `serverContent` frames within a single
        // turn. Each fragment must NOT be committed as its own context entry — otherwise the
        // conversation history fragments into per-frame chunks. Verify the buffer accumulates
        // and flushes exactly once on `turnComplete`.
        const v = new GeminiLiveVoice({
          apiKey: 'k',
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        });
        const addToContext = vi.spyOn(v, 'addToContext');

        await (v as any).handleGeminiMessage({
          serverContent: { outputTranscription: { text: 'Hello' } },
        });
        await (v as any).handleGeminiMessage({
          serverContent: { outputTranscription: { text: ', world' } },
        });
        await (v as any).handleGeminiMessage({
          serverContent: { outputTranscription: { text: '.' } },
        });
        expect(addToContext).not.toHaveBeenCalled();

        await (v as any).handleGeminiMessage({
          serverContent: { turnComplete: true },
        });

        expect(addToContext).toHaveBeenCalledTimes(1);
        expect(addToContext).toHaveBeenCalledWith('assistant', 'Hello, world.');

        v.disconnect();
      });

      it('resets pending assistant text between turns', async () => {
        const v = new GeminiLiveVoice({ apiKey: 'k' });
        const addToContext = vi.spyOn(v, 'addToContext');

        await (v as any).handleGeminiMessage({
          serverContent: { modelTurn: { parts: [{ text: 'first' }] } },
        });
        await (v as any).handleGeminiMessage({ serverContent: { turnComplete: true } });
        await (v as any).handleGeminiMessage({
          serverContent: { modelTurn: { parts: [{ text: 'second' }] } },
        });
        await (v as any).handleGeminiMessage({ serverContent: { turnComplete: true } });

        expect(addToContext).toHaveBeenNthCalledWith(1, 'assistant', 'first');
        expect(addToContext).toHaveBeenNthCalledWith(2, 'assistant', 'second');

        v.disconnect();
      });
    });

    describe('Barge-in cleanup', () => {
      it('ends active speaker streams and clears pending text when interrupted', async () => {
        // The cancelled turn will not be followed by `turnComplete`, so the interrupt handler
        // must end any in-flight speaker streams itself. Otherwise stream counters never drop
        // and playback hangs on the cancelled audio. The partial assistant text from the
        // cancelled turn is also discarded — it never reached the user as a completed reply.
        const v = new GeminiLiveVoice({ apiKey: 'k' });
        const cleanup = vi.spyOn((v as any).audioStreamManager, 'cleanupSpeakerStreams');
        const addToContext = vi.spyOn(v, 'addToContext');

        // Buffer some assistant text into the in-flight turn.
        await (v as any).handleGeminiMessage({
          serverContent: { modelTurn: { parts: [{ text: 'partial reply' }] } },
        });

        // Server cancels the turn.
        await (v as any).handleGeminiMessage({
          serverContent: { interrupted: true },
        });

        expect(cleanup).toHaveBeenCalledTimes(1);

        // A subsequent `turnComplete` (if it arrives at all) must not commit the discarded
        // partial reply to context history.
        await (v as any).handleGeminiMessage({ serverContent: { turnComplete: true } });
        expect(addToContext).not.toHaveBeenCalled();

        v.disconnect();
      });
    });
  });
});
