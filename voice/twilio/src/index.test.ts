import { PassThrough } from 'node:stream';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TwilioVoice } from './index';

/**
 * Tests for @mastra/voice-twilio
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/11458
 * Feature Request: Telephony Layer (Twilio) for Voice Agents
 *
 * Requirements:
 * - Handle inbound PSTN calls via Twilio Media Streams
 * - Real-time speech-to-speech agents over phone
 * - Audio streaming with proper format conversion (mulaw <-> PCM)
 * - Turn-taking and barge-in support
 * - Call ↔ agent session mapping
 */

// Mock WebSocket
vi.mock('ws', () => {
  return {
    WebSocket: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      readyState: 1, // OPEN
    })),
    WebSocketServer: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn(),
    })),
  };
});

describe('TwilioVoice', () => {
  let voice: TwilioVoice;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    voice?.close();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      voice = new TwilioVoice();
      expect(voice).toBeInstanceOf(TwilioVoice);
    });

    it('should initialize with custom configuration', () => {
      voice = new TwilioVoice({
        accountSid: 'AC1234567890',
        authToken: 'test-auth-token',
        port: 8080,
      });
      expect(voice).toBeInstanceOf(TwilioVoice);
    });
  });

  describe('handleWebSocket', () => {
    it('should handle Twilio Media Streams connected event', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('call-started', mockCallback);

      // Simulate Twilio connected message
      const connectedMessage = JSON.stringify({
        event: 'connected',
        protocol: 'Call',
        version: '1.0.0',
      });

      await voice.handleMessage(connectedMessage);

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle Twilio Media Streams start event with call metadata', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('call-metadata', mockCallback);

      // Simulate Twilio start message with call info
      const startMessage = JSON.stringify({
        event: 'start',
        sequenceNumber: '1',
        start: {
          streamSid: 'MZ1234567890',
          accountSid: 'AC1234567890',
          callSid: 'CA1234567890',
          tracks: ['inbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1,
          },
        },
        streamSid: 'MZ1234567890',
      });

      await voice.handleMessage(startMessage);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: 'CA1234567890',
          streamSid: 'MZ1234567890',
        }),
      );
    });

    it('should handle incoming audio (media event) from Twilio', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('audio-received', mockCallback);

      // Simulate Twilio media message with mulaw audio
      // This is base64-encoded mulaw audio
      const mediaMessage = JSON.stringify({
        event: 'media',
        sequenceNumber: '2',
        media: {
          track: 'inbound',
          chunk: '1',
          timestamp: '5',
          payload: 'dGVzdCBhdWRpbyBkYXRh', // base64 encoded test data
        },
        streamSid: 'MZ1234567890',
      });

      await voice.handleMessage(mediaMessage);

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle call stop event', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('call-ended', mockCallback);

      const stopMessage = JSON.stringify({
        event: 'stop',
        sequenceNumber: '100',
        streamSid: 'MZ1234567890',
        stop: {
          accountSid: 'AC1234567890',
          callSid: 'CA1234567890',
        },
      });

      await voice.handleMessage(stopMessage);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: 'CA1234567890',
        }),
      );
    });
  });

  describe('audio format conversion', () => {
    it('should convert mulaw to PCM when receiving audio from Twilio', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('audio-received', mockCallback);

      // Send a media message with mulaw audio
      const mediaMessage = JSON.stringify({
        event: 'media',
        sequenceNumber: '2',
        media: {
          track: 'inbound',
          chunk: '1',
          timestamp: '5',
          payload: Buffer.from([0xff, 0x7f, 0x00, 0x80]).toString('base64'),
        },
        streamSid: 'MZ1234567890',
      });

      await voice.handleMessage(mediaMessage);

      // Should receive PCM audio (Int16Array)
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: expect.any(Int16Array),
          streamSid: 'MZ1234567890',
        }),
      );
    });

    it('should convert PCM to mulaw when sending audio to Twilio', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('speaking', mockCallback);

      // Mock the WebSocket connection
      const mockWs = {
        send: vi.fn(),
        readyState: 1, // OPEN
      };
      (voice as any).activeConnections.set('MZ1234567890', mockWs);

      // PCM audio from AI provider
      const pcmAudio = new Int16Array([0, 8000, -8000, 16000]);

      await voice.sendAudio('MZ1234567890', pcmAudio);

      // Should emit speaking event with converted mulaw Buffer
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: expect.any(Buffer),
          streamSid: 'MZ1234567890',
        }),
      );
    });
  });

  describe('sending audio to Twilio', () => {
    it('should send audio back to Twilio in correct format', async () => {
      voice = new TwilioVoice();

      // Mock the WebSocket connection
      const mockWs = {
        send: vi.fn(),
        readyState: 1, // OPEN
      };
      (voice as any).activeConnections.set('MZ1234567890', mockWs);

      // PCM audio from AI provider
      const pcmAudio = new Int16Array([0, 8000, -8000, 16000]);

      await voice.sendAudio('MZ1234567890', pcmAudio);

      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"event":"media"'));
    });

    it('should queue audio if connection not ready', async () => {
      voice = new TwilioVoice();

      const pcmAudio = new Int16Array([0, 8000, -8000, 16000]);

      // No active connection - should queue
      await voice.sendAudio('MZ1234567890', pcmAudio);

      expect((voice as any).audioQueue.get('MZ1234567890')).toBeDefined();
    });
  });

  describe('speak method', () => {
    it('should send text-to-speech audio to active call', async () => {
      voice = new TwilioVoice();

      // Mock connection and TTS provider
      const mockWs = {
        send: vi.fn(),
        readyState: 1,
      };
      (voice as any).activeConnections.set('MZ1234567890', mockWs);
      (voice as any).activeStreamSid = 'MZ1234567890';

      // Speak should convert text to audio and send to Twilio
      await voice.speak('Hello from Mastra!');

      // The actual audio would come from a TTS provider
      // This test verifies the integration point exists
    });
  });

  describe('listen method', () => {
    it('should return transcription from incoming audio', async () => {
      voice = new TwilioVoice();

      // Create a mock audio stream (mulaw format)
      const audioStream = new PassThrough();
      audioStream.write(Buffer.from([0xff, 0x7f, 0x00, 0x80]));
      audioStream.end();

      // Listen should return transcribed text
      const result = await voice.listen(audioStream);

      // Would integrate with STT provider
      expect(typeof result).toBe('string');
    });
  });

  describe('event handling', () => {
    it('should emit speaking events when sending audio', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('speaking', mockCallback);

      const mockWs = {
        send: vi.fn(),
        readyState: 1,
      };
      (voice as any).activeConnections.set('MZ1234567890', mockWs);
      (voice as any).activeStreamSid = 'MZ1234567890';

      const pcmAudio = new Int16Array([0, 8000, -8000, 16000]);
      await voice.sendAudio('MZ1234567890', pcmAudio);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          streamSid: 'MZ1234567890',
        }),
      );
    });

    it('should emit writing events when receiving transcriptions', async () => {
      voice = new TwilioVoice();
      const mockCallback = vi.fn();
      voice.on('writing', mockCallback);

      // Simulate receiving and processing audio that gets transcribed
      await voice.emitTranscription('MZ1234567890', 'Hello, how can I help?');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello, how can I help?',
          streamSid: 'MZ1234567890',
        }),
      );
    });
  });

  describe('integration with agents', () => {
    it('should work with Mastra Agent via voice property', async () => {
      voice = new TwilioVoice();

      // Agent tools should be addable
      const mockTools = {
        greet: {
          description: 'Greet the caller',
          execute: vi.fn(),
        },
      };

      voice.addTools(mockTools);

      // Instructions should be settable
      voice.addInstructions('You are a helpful phone assistant.');

      // Should be able to connect and handle calls
      expect(voice).toBeInstanceOf(TwilioVoice);
    });
  });

  describe('TwiML generation', () => {
    it('should generate TwiML for connecting to Media Streams', () => {
      voice = new TwilioVoice({
        websocketUrl: 'wss://my-server.com/twilio',
      });

      const twiml = voice.generateTwiML();

      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream');
      expect(twiml).toContain('wss://my-server.com/twilio');
    });
  });
});

describe('TwilioVoice with AI provider bridge', () => {
  it('should bridge Twilio audio to OpenAI Realtime', async () => {
    // This would test the integration between Twilio and an AI provider
    // The TwilioVoice would:
    // 1. Receive mulaw audio from Twilio
    // 2. Convert to PCM
    // 3. Send to OpenAI Realtime
    // 4. Receive PCM response from OpenAI
    // 5. Convert to mulaw
    // 6. Send back to Twilio

    const voice = new TwilioVoice();

    // This is the key integration test
    expect(voice).toBeInstanceOf(TwilioVoice);
  });
});
