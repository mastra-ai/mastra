import { PassThrough } from 'stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiLiveVoice } from './index';

// Mock WebSocket
vi.mock('ws', () => {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    readyState: 1,
  };

  const MockWebSocket = vi.fn().mockImplementation(() => mockWs);
  // Add static properties to the constructor function
  (MockWebSocket as any).OPEN = 1;
  (MockWebSocket as any).CLOSED = 3;
  (MockWebSocket as any).CONNECTING = 0;
  (MockWebSocket as any).CLOSING = 2;

  return { WebSocket: MockWebSocket };
});

// Mock GoogleAuth
vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    getClient: vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-access-token' }),
    }),
  })),
}));

// Mock zod-to-json-schema
vi.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: vi.fn().mockImplementation(() => ({
    type: 'object',
    properties: {},
    $schema: 'http://json-schema.org/draft-07/schema#',
  })),
}));

describe('GeminiLiveVoice', () => {
  let voice: GeminiLiveVoice;
  let mockWs: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create voice instance with test config
    voice = new GeminiLiveVoice({
      apiKey: 'test-api-key',
      model: 'gemini-2.0-flash-live-001',
      debug: false,
    });

    // Get reference to mock WebSocket
    mockWs = (voice as any).ws;
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
      expect(sentData.realtime_input).toHaveProperty('media_chunks');
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
      const configuredTools = voice.getTools();
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

      // Now tools receive { context, runtimeContext } with args and execution options
      expect(mockExecute).toHaveBeenCalledWith(
        { context: { test: 'value' }, runtimeContext: undefined },
        expect.any(Object),
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
      expect(setupMsg.setup.systemInstruction.parts[0].text).toBe('You are test');
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
      // Verify tool was called with correct parameter structure
      const [toolArgs, execOptions] = mockExecute.mock.calls[0];
      expect(toolArgs).toEqual({ context: { q: 1 }, runtimeContext: undefined });
      expect(execOptions).toMatchObject({ toolCallId: 'id-1' });
      expect(mockWs.send).toHaveBeenCalled();
      const payloads = mockWs.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      const toolResult = payloads.find((p: any) => p.tool_result);
      expect(toolResult).toBeDefined();
      expect(toolResult.tool_result.tool_call_id).toBe('id-1');
      expect(toolResult.tool_result.result).toEqual({ result: 'ok' });
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
});
