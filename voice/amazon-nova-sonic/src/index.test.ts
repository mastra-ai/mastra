import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NovaSonicVoice } from './index';

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: class MockBedrockRuntimeClient {
      send = vi.fn().mockResolvedValue({
        body: (async function* () {
          // Empty async generator
        })(),
      });
    },
    InvokeModelWithBidirectionalStreamCommand: class MockCommand {
      constructor(public input: unknown) {}
    },
  };
});

describe('NovaSonicVoice', () => {
  let voice: NovaSonicVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    voice = new NovaSonicVoice({
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    });
  });

  afterEach(() => {
    try {
      voice?.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(voice).toBeInstanceOf(NovaSonicVoice);
      expect(voice.getConnectionState()).toBe('disconnected');
    });

    it('should initialize with custom speaker', () => {
      const customVoice = new NovaSonicVoice({ speaker: 'amy' });
      expect(customVoice).toBeInstanceOf(NovaSonicVoice);
    });

    it('should initialize with VoiceConfig pattern', () => {
      const configuredVoice = new NovaSonicVoice({
        speechModel: { name: 'amazon.nova-sonic-v1:0', apiKey: 'test-key' },
        speaker: 'matthew',
        realtimeConfig: {
          model: 'amazon.nova-sonic-v1:0',
          options: { region: 'us-west-2' },
        },
      });
      expect(configuredVoice).toBeInstanceOf(NovaSonicVoice);
    });
  });

  describe('getSpeakers', () => {
    it('should return array of available voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBe(4);
      expect(speakers[0]).toHaveProperty('voiceId');
      expect(speakers[0]).toHaveProperty('description');
    });

    it('should include all Nova Sonic voices', async () => {
      const speakers = await voice.getSpeakers();
      const voiceIds = speakers.map(s => s.voiceId);
      expect(voiceIds).toContain('tiffany');
      expect(voiceIds).toContain('amy');
      expect(voiceIds).toContain('matthew');
      expect(voiceIds).toContain('ruth');
    });
  });

  describe('connection', () => {
    it('should connect successfully', async () => {
      await voice.connect();
      expect(voice.isConnected()).toBe(true);
      expect(voice.getConnectionState()).toBe('connected');
    });

    it('should disconnect properly', async () => {
      await voice.connect();
      voice.disconnect();
      expect(voice.isConnected()).toBe(false);
    });

    it('should not reconnect if already connected', async () => {
      await voice.connect();
      await voice.connect(); // Should not throw
      expect(voice.isConnected()).toBe(true);
    });
  });

  describe('speak', () => {
    it('should throw error on empty input', async () => {
      await voice.connect();
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });

    it('should throw error when not connected', async () => {
      await expect(voice.speak('Test')).rejects.toThrow('Not connected');
    });

    it('should handle string input', async () => {
      await voice.connect();
      await voice.speak('Hello, world!');
      // Should not throw
    });
  });

  describe('send', () => {
    it('should handle Int16Array input', async () => {
      await voice.connect();
      await voice.send(new Int16Array([1, 2, 3]));
      // Should not throw
    });

    it('should throw error when not connected', async () => {
      await expect(voice.send(new Int16Array([1]))).rejects.toThrow('Not connected');
    });
  });

  describe('event handling', () => {
    it('should register and trigger event listeners', () => {
      const mockCallback = vi.fn();
      voice.on('speaking', mockCallback);

      (voice as any).emit('speaking', { audio: 'test' });

      expect(mockCallback).toHaveBeenCalledWith({ audio: 'test' });
    });

    it('should remove event listeners', () => {
      const mockCallback = vi.fn();
      voice.on('speaking', mockCallback);
      voice.off('speaking', mockCallback);

      (voice as any).emit('speaking', { audio: 'test' });

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('tools and instructions', () => {
    it('should add tools', () => {
      voice.addTools({
        testTool: {
          id: 'testTool',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          execute: async () => ({}),
        },
      });
      // Should not throw
    });

    it('should add instructions', () => {
      voice.addInstructions('You are a helpful assistant.');
      // Should not throw
    });
  });

  describe('configuration', () => {
    it('should update configuration', async () => {
      await voice.connect();
      voice.updateConfig({ speaker: 'amy' });
      // Should not throw
    });
  });
});
