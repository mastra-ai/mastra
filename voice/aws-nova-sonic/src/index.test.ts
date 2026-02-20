import { PassThrough } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NovaSonicVoice } from './index';
import { NovaSonicErrorCode } from './types';
import { NovaSonicError } from './utils/errors';

// Mock AWS SDK
const mockSendFn = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  class MockBedrockRuntimeClient {
    send = mockSendFn;
    constructor(_config?: any) {
      // Constructor implementation
    }
  }

  class MockInvokeModelWithBidirectionalStreamCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  return {
    BedrockRuntimeClient: MockBedrockRuntimeClient,
    InvokeModelWithBidirectionalStreamCommand: MockInvokeModelWithBidirectionalStreamCommand,
  };
});

// Mock credential provider
vi.mock('./utils/auth', () => {
  return {
    getAwsCredentials: vi.fn().mockResolvedValue({
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    }),
  };
});

describe('NovaSonicVoice', () => {
  let voice: NovaSonicVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendFn.mockClear();
    voice = new NovaSonicVoice({
      region: 'us-east-1',
      model: 'amazon.nova-2-sonic-v1:0',
      debug: false,
    });
  });

  afterEach(() => {
    voice.close();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const defaultVoice = new NovaSonicVoice();
      expect(defaultVoice).toBeInstanceOf(NovaSonicVoice);
    });

    it('should create instance with custom config', () => {
      const customVoice = new NovaSonicVoice({
        region: 'us-west-2',
        model: 'amazon.nova-2-sonic-v1:0',
        speaker: 'custom-voice',
      });
      expect(customVoice).toBeInstanceOf(NovaSonicVoice);
    });

    it('should throw error for invalid region', () => {
      expect(() => {
        new NovaSonicVoice({
          region: 'invalid-region' as any,
        });
      }).toThrow(NovaSonicError);
    });
  });

  describe('getSpeakers', () => {
    it('should return available speakers', async () => {
      const speakers = await voice.getSpeakers();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
    });

    it('should return all 18 Nova 2 Sonic voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(speakers.length).toBe(18);
    });

    it('should include all required voice properties', async () => {
      const speakers = await voice.getSpeakers();
      speakers.forEach((speaker) => {
        expect(speaker).toHaveProperty('voiceId');
        expect(speaker).toHaveProperty('name');
        expect(speaker).toHaveProperty('language');
        expect(speaker).toHaveProperty('locale');
        expect(speaker).toHaveProperty('gender');
        expect(speaker).toHaveProperty('polyglot');
        expect(typeof speaker.voiceId).toBe('string');
        expect(typeof speaker.name).toBe('string');
        expect(typeof speaker.language).toBe('string');
        expect(typeof speaker.locale).toBe('string');
        expect(['masculine', 'feminine']).toContain(speaker.gender);
        expect(typeof speaker.polyglot).toBe('boolean');
      });
    });

    it('should include polyglot voices (tiffany and matthew)', async () => {
      const speakers = await voice.getSpeakers();
      const tiffany = speakers.find((s) => s.voiceId === 'tiffany');
      const matthew = speakers.find((s) => s.voiceId === 'matthew');
      
      expect(tiffany).toBeDefined();
      expect(tiffany?.polyglot).toBe(true);
      expect(tiffany?.locale).toBe('en-US');
      expect(tiffany?.gender).toBe('feminine');
      
      expect(matthew).toBeDefined();
      expect(matthew?.polyglot).toBe(true);
      expect(matthew?.locale).toBe('en-US');
      expect(matthew?.gender).toBe('masculine');
    });

    it('should include all language variants', async () => {
      const speakers = await voice.getSpeakers();
      const locales = new Set(speakers.map((s) => s.locale));
      
      expect(locales.has('en-US')).toBe(true);
      expect(locales.has('en-GB')).toBe(true);
      expect(locales.has('en-AU')).toBe(true);
      expect(locales.has('en-IN')).toBe(true);
      expect(locales.has('fr-FR')).toBe(true);
      expect(locales.has('it-IT')).toBe(true);
      expect(locales.has('de-DE')).toBe(true);
      expect(locales.has('es-US')).toBe(true);
      expect(locales.has('pt-BR')).toBe(true);
      expect(locales.has('hi-IN')).toBe(true);
    });

    it('should include all documented voice IDs', async () => {
      const speakers = await voice.getSpeakers();

      // 18 total entries: 16 unique voiceIds, with kiara and arjun each appearing
      // for both en-IN and hi-IN locales
      expect(speakers).toHaveLength(18);

      const expectedSpeakers = [
        { voiceId: 'tiffany', locale: 'en-US' },
        { voiceId: 'matthew', locale: 'en-US' },
        { voiceId: 'amy', locale: 'en-GB' },
        { voiceId: 'olivia', locale: 'en-AU' },
        { voiceId: 'kiara', locale: 'en-IN' },
        { voiceId: 'arjun', locale: 'en-IN' },
        { voiceId: 'ambre', locale: 'fr-FR' },
        { voiceId: 'florian', locale: 'fr-FR' },
        { voiceId: 'beatrice', locale: 'it-IT' },
        { voiceId: 'lorenzo', locale: 'it-IT' },
        { voiceId: 'tina', locale: 'de-DE' },
        { voiceId: 'lennart', locale: 'de-DE' },
        { voiceId: 'lupe', locale: 'es-US' },
        { voiceId: 'carlos', locale: 'es-US' },
        { voiceId: 'carolina', locale: 'pt-BR' },
        { voiceId: 'leo', locale: 'pt-BR' },
        { voiceId: 'kiara', locale: 'hi-IN' },
        { voiceId: 'arjun', locale: 'hi-IN' },
      ];

      expectedSpeakers.forEach(({ voiceId, locale }) => {
        expect(speakers).toContainEqual(expect.objectContaining({ voiceId, locale }));
      });
    });
  });

  describe('connect', () => {
    beforeEach(async () => {
      // Reset credentials mock before each test
      const { getAwsCredentials } = await import('./utils/auth');
      vi.mocked(getAwsCredentials).mockResolvedValue({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });
    });

    it('should connect successfully', async () => {
      // Mock the stream response
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      // Mock the send method to return the stream
      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      await voice.connect();

      expect(voice['state']).toBe('connected');
      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should throw error when credentials are missing', async () => {
      const { getAwsCredentials } = await import('./utils/auth');
      vi.mocked(getAwsCredentials).mockRejectedValue(
        new NovaSonicError(NovaSonicErrorCode.CREDENTIALS_MISSING, 'Credentials missing'),
      );

      await expect(voice.connect()).rejects.toThrow(NovaSonicError);
    });

    it('should use default inferenceConfiguration when not provided', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      await voice.connect();

      const eventQueue = (voice as any)._eventQueue;
      const sessionStartEvent = eventQueue.find((e: any) => e.event?.sessionStart);
      
      expect(sessionStartEvent).toBeDefined();
      expect(sessionStartEvent.event.sessionStart.inferenceConfiguration).toEqual({
        maxTokens: 4096,
        topP: 0.9,
        temperature: 0.7,
      });
    });

    it('should include sessionStart with inferenceConfiguration', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          inferenceConfiguration: {
            maxTokens: 2048,
            topP: 0.8,
            temperature: 0.6,
            topK: 50,
            stopSequences: ['stop'],
          },
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      // Verify the command was called
      expect(mockSendFn).toHaveBeenCalled();
      const command = mockSendFn.mock.calls[0][0];
      
      // The body is an async iterable, so we need to check the first event
      const eventQueue = (voiceWithConfig as any)._eventQueue;
      expect(eventQueue).toBeDefined();
      expect(eventQueue.length).toBeGreaterThan(0);
      
      const sessionStartEvent = eventQueue.find((e: any) => e.event?.sessionStart);
      expect(sessionStartEvent).toBeDefined();
      expect(sessionStartEvent.event.sessionStart.inferenceConfiguration).toEqual({
        maxTokens: 2048,
        topP: 0.8,
        temperature: 0.6,
        topK: 50,
        stopSequences: ['stop'],
      });
    });

    it('should include sessionStart with turnDetectionConfiguration', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          turnDetectionConfiguration: {
            endpointingSensitivity: 'MEDIUM',
          },
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const sessionStartEvent = eventQueue.find((e: any) => e.event?.sessionStart);
      
      expect(sessionStartEvent).toBeDefined();
      expect(sessionStartEvent.event.sessionStart.turnDetectionConfiguration).toEqual({
        endpointingSensitivity: 'MEDIUM',
      });
      // Verify turnTaking is NOT included (Nova 2 Sonic doesn't support it)
      expect(sessionStartEvent.event.sessionStart.turnTaking).toBeUndefined();
    });

    it('should support all endpointingSensitivity values (HIGH, MEDIUM, LOW)', async () => {
      const sensitivities: Array<'HIGH' | 'MEDIUM' | 'LOW'> = ['HIGH', 'MEDIUM', 'LOW'];
      
      for (const sensitivity of sensitivities) {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
          },
        };

        mockSendFn.mockResolvedValue({
          body: mockStream,
        });

        const voiceWithConfig = new NovaSonicVoice({
          region: 'us-east-1',
          sessionConfig: {
            turnDetectionConfiguration: {
              endpointingSensitivity: sensitivity,
            },
          },
          debug: false,
        });

        await voiceWithConfig.connect();

        const eventQueue = (voiceWithConfig as any)._eventQueue;
        const sessionStartEvent = eventQueue.find((e: any) => e.event?.sessionStart);
        
        expect(sessionStartEvent.event.sessionStart.turnDetectionConfiguration.endpointingSensitivity).toBe(sensitivity);
        
        // Clean up for next iteration
        await voiceWithConfig.close();
        vi.clearAllMocks();
      }
    });

    it('should include promptStart with toolConfiguration structure', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          tools: [
            {
              name: 'test_tool',
              description: 'A test tool',
              inputSchema: {
                type: 'object',
                properties: {
                  param: { type: 'string' },
                },
                required: ['param'],
              },
            },
          ],
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration.tools).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration.tools.length).toBe(1);
      
      // Verify toolSpec structure
      const toolSpec = promptStartEvent.event.promptStart.toolConfiguration.tools[0].toolSpec;
      expect(toolSpec.name).toBe('test_tool');
      expect(toolSpec.description).toBe('A test tool');
      expect(toolSpec.inputSchema.json).toBeDefined();
      
      // Verify inputSchema is a JSON string
      const parsedSchema = JSON.parse(toolSpec.inputSchema.json);
      expect(parsedSchema).toEqual({
        type: 'object',
        properties: {
          param: { type: 'string' },
        },
        required: ['param'],
      });
      
      // Verify old structure is NOT present
      expect(promptStartEvent.event.promptStart.tools).toBeUndefined();
    });

    it('should handle inputSchema as both object and string', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      // Test with object inputSchema
      const voiceWithObjectSchema = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          tools: [
            {
              name: 'object_schema_tool',
              description: 'Tool with object schema',
              inputSchema: {
                type: 'object',
                properties: { param: { type: 'string' } },
              },
            },
          ],
        },
        debug: false,
      });

      await voiceWithObjectSchema.connect();
      const eventQueue1 = (voiceWithObjectSchema as any)._eventQueue;
      const promptStartEvent1 = eventQueue1.find((e: any) => e.event?.promptStart);
      const schema1 = JSON.parse(promptStartEvent1.event.promptStart.toolConfiguration.tools[0].toolSpec.inputSchema.json);
      expect(schema1.type).toBe('object');

      await voiceWithObjectSchema.close();
      vi.clearAllMocks();

      // Test with string inputSchema
      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithStringSchema = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          tools: [
            {
              name: 'string_schema_tool',
              description: 'Tool with string schema',
              inputSchema: JSON.stringify({
                type: 'object',
                properties: { param: { type: 'string' } },
              }) as any,
            },
          ],
        },
        debug: false,
      });

      await voiceWithStringSchema.connect();
      const eventQueue2 = (voiceWithStringSchema as any)._eventQueue;
      const promptStartEvent2 = eventQueue2.find((e: any) => e.event?.promptStart);
      const schema2 = JSON.parse(promptStartEvent2.event.promptStart.toolConfiguration.tools[0].toolSpec.inputSchema.json);
      expect(schema2.type).toBe('object');
    });

    it('should NOT include knowledgeBaseConfig in promptStart (not supported in Nova 2 Sonic bidirectional API)', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          knowledgeBaseConfig: {
            knowledgeBaseId: 'test-kb-id',
            dataSourceId: 'test-ds-id',
          },
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      // knowledgeBaseConfig is not included in Nova 2 Sonic promptStart event
      expect(promptStartEvent.event.promptStart.knowledgeBaseConfig).toBeUndefined();
    });

    it('should include toolChoice inside toolConfiguration', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          toolChoice: 'any',
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration.toolChoice).toBe('any');
      // Verify toolChoice is NOT at top level
      expect(promptStartEvent.event.promptStart.toolChoice).toBeUndefined();
    });

    it('should include toolChoice with tools in toolConfiguration', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          tools: [
            {
              name: 'test_tool',
              description: 'A test tool',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
          toolChoice: 'auto',
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration.toolChoice).toBe('auto');
      expect(promptStartEvent.event.promptStart.toolConfiguration.tools).toBeDefined();
      expect(promptStartEvent.event.promptStart.toolConfiguration.tools.length).toBe(1);
    });

    it('should use default voice (matthew) when no speaker specified', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const testVoice = new NovaSonicVoice({
        region: 'us-east-1',
        debug: false,
      });

      await testVoice.connect();

      const eventQueue = (testVoice as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      expect(promptStartEvent.event.promptStart.audioOutputConfiguration.voiceId).toBe('matthew');
      
      testVoice.close();
    });

    it('should use speaker from config when specified', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithSpeaker = new NovaSonicVoice({
        region: 'us-east-1',
        speaker: 'tiffany',
        debug: false,
      });

      await voiceWithSpeaker.connect();

      const eventQueue = (voiceWithSpeaker as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      expect(promptStartEvent.event.promptStart.audioOutputConfiguration.voiceId).toBe('tiffany');
      
      voiceWithSpeaker.close();
    });

    it('should prioritize sessionConfig.voice over speaker', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        speaker: 'tiffany',
        sessionConfig: {
          voice: 'amy',
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      // sessionConfig.voice should take priority
      expect(promptStartEvent.event.promptStart.audioOutputConfiguration.voiceId).toBe('amy');
      
      voiceWithConfig.close();
    });

    it('should support voice object in sessionConfig', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const voiceWithConfig = new NovaSonicVoice({
        region: 'us-east-1',
        sessionConfig: {
          voice: {
            name: 'olivia',
            languageCode: 'en-AU',
            gender: 'feminine',
          },
        },
        debug: false,
      });

      await voiceWithConfig.connect();

      const eventQueue = (voiceWithConfig as any)._eventQueue;
      const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
      
      expect(promptStartEvent).toBeDefined();
      expect(promptStartEvent.event.promptStart.audioOutputConfiguration.voiceId).toBe('olivia');
      
      voiceWithConfig.close();
    });

    it('should support all available voice IDs', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ contentStart: {} })) } };
        },
      };

      mockSendFn.mockResolvedValue({
        body: mockStream,
      });

      const availableVoices = [
        'tiffany', 'matthew', 'amy', 'olivia', 'kiara', 'arjun',
        'ambre', 'florian', 'beatrice', 'lorenzo', 'tina', 'lennart',
        'lupe', 'carlos', 'carolina', 'leo',
      ];

      for (const voiceId of availableVoices) {
        const testVoice = new NovaSonicVoice({
          region: 'us-east-1',
          speaker: voiceId,
          debug: false,
        });

        await testVoice.connect();

        const eventQueue = (testVoice as any)._eventQueue;
        const promptStartEvent = eventQueue.find((e: any) => e.event?.promptStart);
        
        expect(promptStartEvent).toBeDefined();
        expect(promptStartEvent.event.promptStart.audioOutputConfiguration.voiceId).toBe(voiceId);
        
        testVoice.close();
      }
    });
  });

  describe('speak', () => {
    it('should throw error when not connected', async () => {
      await expect(voice.speak('Hello')).rejects.toThrow(
        expect.objectContaining({ code: NovaSonicErrorCode.NOT_CONNECTED }),
      );
    });

    it('should throw error for empty text', async () => {
      // Mock connection
      voice['state'] = 'connected' as any;
      await expect(voice.speak('')).rejects.toThrow(NovaSonicError);
    });
  });

  describe('listen', () => {
    it('should throw error when not connected', async () => {
      const mockStream = {
        read: vi.fn(),
      };
      await expect(voice.listen(mockStream as any)).rejects.toThrow(
        expect.objectContaining({ code: NovaSonicErrorCode.NOT_CONNECTED }),
      );
    });
  });

  describe('send', () => {
    it('should throw error when not connected', async () => {
      const audioData = new Int16Array([1, 2, 3]);
      await expect(voice.send(audioData)).rejects.toThrow(
        expect.objectContaining({ code: NovaSonicErrorCode.NOT_CONNECTED }),
      );
    });

    it('should throw error for invalid audio format', async () => {
      voice['state'] = 'connected' as any;
      await expect(voice.send('invalid' as any)).rejects.toThrow(
        expect.objectContaining({ code: NovaSonicErrorCode.INVALID_AUDIO_FORMAT }),
      );
    });
  });

  describe('event handling', () => {
    it('should register event listeners', () => {
      const callback = vi.fn();
      voice.on('speaking', callback);
      expect(voice['events']['speaking']).toContain(callback);
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();
      voice.on('speaking', callback);
      voice.off('speaking', callback);
      expect(voice['events']['speaking']).not.toContain(callback);
    });

    it('should emit events', () => {
      const callback = vi.fn();
      voice.on('error', callback);
      voice['emit']('error', { message: 'Test error' });
      expect(callback).toHaveBeenCalledWith({ message: 'Test error' });
    });
  });

  describe('close', () => {
    it('should close connection and cleanup', () => {
      voice['state'] = 'connected' as any;
      // Create a proper PassThrough stream instead of empty object
      const mockStream = new PassThrough() as any;
      mockStream.id = 'test-id';
      voice['speakerStreams'].set('test-id', mockStream);
      voice.close();
      expect(voice['state']).toBe('disconnected');
      expect(voice['speakerStreams'].size).toBe(0);
    });
  });

  describe('getListener', () => {
    it('should return enabled when connected', async () => {
      voice['state'] = 'connected' as any;
      const listener = await voice.getListener();
      expect(listener.enabled).toBe(true);
    });

    it('should return disabled when not connected', async () => {
      voice['state'] = 'disconnected' as any;
      const listener = await voice.getListener();
      expect(listener.enabled).toBe(false);
    });
  });
});

